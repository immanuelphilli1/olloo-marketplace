<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\OrderPaymentStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Jobs\AuthoriseAndCaptureTamaraOrder;
use App\Jobs\CapturePaypalOrder;
use App\Jobs\CaptureTabbyPayment;
use App\Jobs\NotifyCustomerOrderPaid;
use App\Jobs\NotifyStaffPaymentReceived;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentWebhookEvent;
use App\Payments\DTOs\VerifiedCharge;
use App\Payments\PaymentGatewayManager;
use App\Payments\PaymentStatusMapper;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

final class PaymentSettlementService
{
    public function __construct(
        private readonly PaymentGatewayManager $gateways,
        private readonly NotificationRecipientSettings $recipients,
        private readonly StaffNotificationFanout $fanout,
    ) {}

    public function processWebhookEvent(PaymentWebhookEvent $event): void
    {
        if ($event->processed_at !== null) {
            return;
        }

        /** @var array<string, mixed> $payload */
        $payload = is_array($event->payload) ? $event->payload : [];
        $reference = is_string($payload['reference'] ?? null) ? $payload['reference'] : null;

        $payment = $this->findPayment($event->provider, $reference, $payload);

        if (! $payment instanceof Payment) {
            Log::warning('Payment webhook could not resolve payment', [
                'provider' => $event->provider,
                'external_event_id' => $event->external_event_id,
                'reference' => $reference,
            ]);

            $event->forceFill(['processed_at' => now()])->save();

            return;
        }

        $verifyReference = is_string($payment->external_reference) && $payment->external_reference !== ''
            ? $payment->external_reference
            : (string) ($reference ?? $payment->rid);

        $charge = $this->gateways->gateway($payment->provider)->verifyCharge($verifyReference);

        $this->applyVerifiedCharge($payment, $charge);
        $this->dispatchProviderFollowUp($payment, $event);

        $event->forceFill(['processed_at' => now()])->save();
    }

    public function applyVerifiedCharge(Payment $payment, VerifiedCharge $charge): void
    {
        $becameCompleted = false;
        $reviewReason = null;

        DB::transaction(function () use ($payment, $charge, &$becameCompleted, &$reviewReason): void {
            $payment = Payment::query()->lockForUpdate()->find($payment->id);
            if (! $payment instanceof Payment) {
                return;
            }

            if (in_array($payment->status, [PaymentStatus::Completed->value, PaymentStatus::NeedsReview->value], true)) {
                return;
            }

            $order = $payment->order_id !== null
                ? Order::query()->lockForUpdate()->find($payment->order_id)
                : null;

            $status = $charge->paid ? PaymentStatus::Completed : PaymentStatusMapper::map($charge->status);

            if ($status === PaymentStatus::Completed) {
                $reviewReason = $this->reviewReason($payment, $order, $charge);
                if ($reviewReason !== null) {
                    $status = PaymentStatus::NeedsReview;
                }
            }

            $payment->update([
                'status' => $status->value,
                'external_reference' => $charge->externalReference !== ''
                    ? $charge->externalReference
                    : $payment->external_reference,
                'metadata' => $reviewReason === null ? $payment->metadata : array_merge($payment->metadata ?? [], [
                    'review_reason' => $reviewReason,
                    'charged_amount_minor' => $charge->amountMinor,
                    'charged_currency' => $charge->currencyCode,
                ]),
            ]);

            if ($order instanceof Order) {
                $this->applyToOrder($order, $payment, $status);
            }

            $becameCompleted = $status === PaymentStatus::Completed;
        });

        if ($becameCompleted) {
            NotifyStaffPaymentReceived::dispatch($payment->id);
            if ($payment->fresh()?->order_id !== null) {
                NotifyCustomerOrderPaid::dispatch($payment->id);
            }
        }

        if ($reviewReason !== null) {
            Log::warning('Payment needs staff review', [
                'payment_rid' => $payment->rid,
                'reason' => $reviewReason,
            ]);

            $this->fanout->notifyStaffEmails(
                emails: $this->recipients->getEmails(NotificationRecipientSettings::CHANNEL_PAYMENT),
                type: 'payment',
                title: 'Payment needs review',
                message: $reviewReason.' ('.$payment->rid.')',
                data: ['payment_rid' => $payment->rid],
            );
        }
    }

    /**
     * Approval-style providers need a second step after our books update:
     * PayPal approvals must be captured, Tabby authorisations collected, and
     * Tamara approvals authorised then captured. Each job is idempotent, so
     * duplicate webhooks only re-check.
     */
    private function dispatchProviderFollowUp(Payment $payment, PaymentWebhookEvent $event): void
    {
        $eventType = is_array($event->payload) ? ($event->payload['event_type'] ?? null) : null;
        $fresh = $payment->fresh();
        if (! $fresh instanceof Payment) {
            return;
        }

        if ($payment->provider === 'paypal'
            && $eventType === 'CHECKOUT.ORDER.APPROVED'
            && $fresh->status === PaymentStatus::Pending->value) {
            CapturePaypalOrder::dispatch($fresh->id);
        }

        if ($payment->provider === 'tabby'
            && $fresh->status === PaymentStatus::Completed->value) {
            CaptureTabbyPayment::dispatch($fresh->id);
        }

        if ($payment->provider === 'tamara'
            && $eventType === 'order_approved'
            && $fresh->status === PaymentStatus::Pending->value) {
            AuthoriseAndCaptureTamaraOrder::dispatch($fresh->id);
        }
    }

    /**
     * A provider "paid" only settles the order when it is for exactly what we
     * asked, and the order still wants paying. Otherwise money was taken that
     * staff must reconcile (usually by refunding).
     */
    private function reviewReason(Payment $payment, ?Order $order, VerifiedCharge $charge): ?string
    {
        if ($charge->amountMinor !== null && $charge->amountMinor !== (int) $payment->amount_minor) {
            return "Charged {$charge->amountMinor} minor units, expected {$payment->amount_minor}.";
        }

        if ($charge->currencyCode !== null && strtoupper($charge->currencyCode) !== strtoupper((string) $payment->currency_code)) {
            return "Charged in {$charge->currencyCode}, expected {$payment->currency_code}.";
        }

        if (! $order instanceof Order) {
            return null;
        }

        if ((int) $order->total_minor !== (int) $payment->amount_minor || $order->currency_code !== $payment->currency_code) {
            return "Payment amount does not match order {$order->order_reference} total.";
        }

        if ($order->payment_status === OrderPaymentStatus::Paid) {
            return "Order {$order->order_reference} was already paid by another payment.";
        }

        if ($order->status === OrderStatus::Cancelled) {
            return "Order {$order->order_reference} was cancelled before this payment arrived.";
        }

        return null;
    }

    private function applyToOrder(Order $order, Payment $payment, PaymentStatus $status): void
    {
        match ($status) {
            PaymentStatus::Completed => $order->update([
                'payment_status' => OrderPaymentStatus::Paid,
                'status' => $order->status === OrderStatus::PendingPayment ? OrderStatus::Processing : $order->status,
                'payment_method' => $payment->provider,
            ]),
            // The order stays awaiting payment so the customer can try again.
            PaymentStatus::Failed => $order->payment_status === OrderPaymentStatus::Unpaid
                ? $order->update(['payment_status' => OrderPaymentStatus::Failed])
                : null,
            PaymentStatus::Refunded => $order->payment_status === OrderPaymentStatus::Paid
                ? $order->update(['payment_status' => OrderPaymentStatus::Refunded])
                : null,
            PaymentStatus::Pending, PaymentStatus::NeedsReview => null,
        };
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function findPayment(string $provider, ?string $reference, array $payload): ?Payment
    {
        if (is_string($reference) && $reference !== '') {
            $byRid = Payment::query()
                ->where('provider', $provider)
                ->where('rid', $reference)
                ->first();

            if ($byRid instanceof Payment) {
                return $byRid;
            }

            $byExternal = Payment::query()
                ->where('provider', $provider)
                ->where('external_reference', $reference)
                ->first();

            if ($byExternal instanceof Payment) {
                return $byExternal;
            }
        }

        $raw = is_array($payload['raw'] ?? null) ? $payload['raw'] : $payload;
        $object = is_array($raw['data']['object'] ?? null)
            ? $raw['data']['object']
            : (is_array($raw['data'] ?? null) ? $raw['data'] : []);

        $candidates = [
            is_array($object['metadata'] ?? null) ? ($object['metadata']['payment_rid'] ?? null) : null,
            $object['client_reference_id'] ?? null,
            $object['id'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if (! is_string($candidate) || $candidate === '') {
                continue;
            }

            $payment = Payment::query()
                ->where('provider', $provider)
                ->where(function ($query) use ($candidate): void {
                    $query->where('rid', $candidate)
                        ->orWhere('external_reference', $candidate);
                })
                ->first();

            if ($payment instanceof Payment) {
                return $payment;
            }
        }

        return null;
    }
}
