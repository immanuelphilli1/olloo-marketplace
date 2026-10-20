<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Enums\PaymentStatus;
use App\Mail\OrderPaidMail;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;

final class NotifyCustomerOrderPaid implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly int $paymentId) {}

    public function handle(): void
    {
        $payment = Payment::query()->with(['order.user'])->find($this->paymentId);
        if (! $payment instanceof Payment || $payment->status !== PaymentStatus::Completed->value) {
            return;
        }

        $order = $payment->order;
        if (! $order instanceof Order) {
            return;
        }

        $meta = is_array($payment->metadata) ? $payment->metadata : [];
        if (! empty($meta['customer_paid_notified_at'])) {
            return;
        }

        $email = $this->resolveCustomerEmail($order);
        if ($email === null) {
            return;
        }

        if (! $this->shouldNotify($order->user)) {
            return;
        }

        Mail::to($email)->send(new OrderPaidMail($order));

        $meta['customer_paid_notified_at'] = now()->toIso8601String();
        $payment->forceFill(['metadata' => $meta])->save();
    }

    private function resolveCustomerEmail(Order $order): ?string
    {
        $userEmail = $order->user?->email;
        if (is_string($userEmail) && $userEmail !== '') {
            return $userEmail;
        }

        $snapshot = is_array($order->address_snapshot) ? $order->address_snapshot : [];
        $snapEmail = $snapshot['email'] ?? null;

        return is_string($snapEmail) && $snapEmail !== '' ? $snapEmail : null;
    }

    private function shouldNotify(?User $user): bool
    {
        if ($user === null) {
            return true;
        }

        return (bool) $user->notify_order_updates;
    }
}
