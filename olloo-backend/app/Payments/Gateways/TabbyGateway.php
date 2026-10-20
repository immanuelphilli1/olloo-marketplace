<?php

declare(strict_types=1);

namespace App\Payments\Gateways;

use App\Models\Order;
use App\Payments\Concerns\LogsProviderRequests;
use App\Payments\Contracts\PaymentGateway;
use App\Payments\DTOs\CheckoutRequest;
use App\Payments\DTOs\CheckoutSession;
use App\Payments\DTOs\VerifiedCharge;
use App\Payments\DTOs\WebhookEvent;
use App\Services\ExternalRequestLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;
use RuntimeException;

/**
 * Tabby pay-in-instalments (UAE/KSA): session, buyer approves on Tabby, we
 * capture the full amount. Tabby pays out the full total minus its fee, so
 * settlement still checks the full order amount. Docs: docs.tabby.ai.
 */
final class TabbyGateway implements PaymentGateway
{
    use LogsProviderRequests;

    public function __construct(
        private readonly ExternalRequestLogger $requestLogger,
    ) {}

    public function key(): string
    {
        return 'tabby';
    }

    public function createCheckout(CheckoutRequest $request): CheckoutSession
    {
        $this->assertConfigured();
        $order = $this->orderFor($request);
        $currency = strtoupper($request->currencyCode);

        if (! in_array($currency, ['AED', 'SAR'], true)) {
            throw new InvalidArgumentException("Tabby supports AED and SAR, not {$currency}.");
        }

        $user = $order->user;
        $snapshot = is_array($order->address_snapshot) ? $order->address_snapshot : [];
        [$firstName, $lastName] = $this->splitName((string) ($user?->name ?? 'Customer'));

        $response = $this->loggedRequest(
            'tabby',
            'POST',
            $this->base().'/api/v2/checkout',
            ['Authorization' => 'Bearer '.config('payments.providers.tabby.secret_key')],
            [
                'payment' => [
                    'amount' => $this->major((int) $request->amountMinor),
                    'currency' => $currency,
                    'buyer' => [
                        'name' => trim($firstName.' '.$lastName),
                        'email' => $request->customerEmail,
                        'phone' => $this->phone($snapshot),
                    ],
                    'shipping_address' => [
                        'city' => (string) ($snapshot['city'] ?? 'Dubai'),
                        'address' => (string) ($snapshot['addressLine'] ?? $snapshot['line1'] ?? 'Dubai'),
                        'zip' => '00000',
                    ],
                    'order' => [
                        'reference_id' => $order->order_reference,
                        'items' => $this->items($order),
                    ],
                    'buyer_history' => [
                        'registered_since' => optional($user?->created_at ?? $order->created_at)?->toIso8601String(),
                    ],
                    'meta' => ['payment_rid' => $request->reference],
                ],
                'lang' => 'en',
                'merchant_code' => (string) config('payments.providers.tabby.merchant_code'),
                'merchant_urls' => [
                    'success' => $request->returnUrl,
                    'cancel' => $request->cancelReturnUrl,
                    'failure' => $request->cancelReturnUrl,
                ],
            ],
            'checkout.create',
            $request->reference,
        );

        /** @var array<string, mixed> $session */
        $session = is_array($response->json()) ? $response->json() : [];

        if (($session['status'] ?? null) === 'rejected') {
            throw new InvalidArgumentException('Tabby is unable to approve this purchase. Please use an alternative payment method.');
        }

        $webUrl = $this->webUrl($session);
        $paymentId = is_string($session['payment']['id'] ?? null) ? $session['payment']['id'] : '';

        if (! $response->successful() || ($session['status'] ?? null) !== 'created' || $webUrl === '' || $paymentId === '') {
            Log::warning('Tabby session create failed', ['status' => $response->status(), 'reference' => $request->reference]);
            throw new RuntimeException('Tabby session failed: '.mb_substr($response->body(), 0, 200));
        }

        return new CheckoutSession(
            provider: $this->key(),
            reference: $paymentId,
            checkoutUrl: $webUrl,
            raw: $session,
        );
    }

    /**
     * Capture the full authorised amount. Closed payments are already done.
     */
    public function captureFull(string $tabbyPaymentId, int $amountMinor, string $paymentRid): void
    {
        $payment = $this->retrievePayment($tabbyPaymentId, $paymentRid);
        $status = strtoupper((string) ($payment['status'] ?? ''));

        if ($status === 'CLOSED') {
            return;
        }

        if ($status !== 'AUTHORIZED') {
            Log::info('Tabby capture skipped: payment not authorized', ['status' => $status, 'reference' => $paymentRid]);

            return;
        }

        $response = $this->loggedRequest(
            'tabby',
            'POST',
            $this->base().'/api/v2/payments/'.rawurlencode($tabbyPaymentId).'/captures',
            ['Authorization' => 'Bearer '.config('payments.providers.tabby.secret_key')],
            [
                'amount' => $this->major($amountMinor),
                'reference_id' => $paymentRid,
            ],
            'payments.capture',
            $paymentRid,
        );

        if (! $response->successful()) {
            Log::warning('Tabby capture failed', ['status' => $response->status(), 'reference' => $paymentRid]);
            throw new RuntimeException('Tabby capture failed: '.mb_substr($response->body(), 0, 200));
        }
    }

    public function parseWebhook(Request $request): WebhookEvent
    {
        $this->assertConfigured();
        $this->verifySignature($request);

        $decoded = json_decode($request->getContent(), true);
        /** @var array<string, mixed> $payload */
        $payload = is_array($decoded) ? $decoded : [];
        $status = strtolower((string) ($payload['status'] ?? 'unknown'));

        $meta = is_array($payload['meta'] ?? null) ? $payload['meta'] : [];
        $order = is_array($payload['order'] ?? null) ? $payload['order'] : [];
        $reference = is_string($meta['payment_rid'] ?? null) && $meta['payment_rid'] !== ''
            ? $meta['payment_rid']
            : (is_string($order['reference_id'] ?? null) ? $order['reference_id'] : null);

        $eventId = 'tabby:'.((string) ($payload['id'] ?? $reference ?? 'unknown')).':'.$status;

        return new WebhookEvent(
            provider: $this->key(),
            externalEventId: $eventId,
            eventType: 'payment_'.$status,
            reference: $reference,
            payload: $payload,
            // Authorized means Tabby guarantees the money; capturing it is our
            // receivable, collected by CaptureTabbyPayment.
            paid: in_array($status, ['authorized', 'closed'], true),
        );
    }

    public function verifyCharge(string $externalReference): VerifiedCharge
    {
        $payment = $this->retrievePayment(trim($externalReference), trim($externalReference));
        $status = strtoupper((string) ($payment['status'] ?? 'UNKNOWN'));

        return new VerifiedCharge(
            externalReference: is_string($payment['id'] ?? null) ? $payment['id'] : trim($externalReference),
            status: strtolower($status),
            paid: in_array($status, ['AUTHORIZED', 'CLOSED'], true),
            amountMinor: $this->toMinor($payment['amount'] ?? null),
            currencyCode: is_string($payment['currency'] ?? null) ? strtoupper($payment['currency']) : null,
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function retrievePayment(string $tabbyPaymentId, ?string $paymentKey = null): array
    {
        $this->assertConfigured();

        if ($tabbyPaymentId === '') {
            throw new RuntimeException('Tabby verify requires a payment id.');
        }

        $response = $this->loggedRequest(
            'tabby',
            'GET',
            $this->base().'/api/v1/payments/'.rawurlencode($tabbyPaymentId),
            ['Authorization' => 'Bearer '.config('payments.providers.tabby.secret_key')],
            null,
            'payments.retrieve',
            $paymentKey,
        );

        if (! $response->successful()) {
            throw new RuntimeException('Tabby retrieve failed: '.mb_substr($response->body(), 0, 200));
        }

        /** @var array<string, mixed> $payment */
        $payment = is_array($response->json()) ? $response->json() : [];

        return $payment;
    }

    private function base(): string
    {
        return rtrim((string) config('payments.providers.tabby.base_url', 'https://api.tabby.ai'), '/');
    }

    private function assertConfigured(): void
    {
        if ((string) config('payments.providers.tabby.secret_key') === ''
            || (string) config('payments.providers.tabby.merchant_code') === '') {
            throw new RuntimeException('Tabby is not configured (TABBY_SECRET_KEY / TABBY_MERCHANT_CODE).');
        }
    }

    private function orderFor(CheckoutRequest $request): Order
    {
        $orderRid = is_array($request->metadata) ? ($request->metadata['order_rid'] ?? null) : null;

        $order = is_string($orderRid) && $orderRid !== ''
            ? Order::query()->where('rid', $orderRid)->with(['items.product.category', 'user'])->first()
            : null;

        if (! $order instanceof Order) {
            throw new RuntimeException('Tabby checkout needs its order (missing order_rid).');
        }

        return $order;
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function splitName(string $name): array
    {
        $parts = preg_split('/\s+/', trim($name), 2) ?: [];

        return [$parts[0] ?? 'Customer', $parts[1] ?? ($parts[0] ?? 'Customer')];
    }

    /**
     * @param  array<string, mixed>  $snapshot
     */
    private function phone(array $snapshot): string
    {
        $digits = preg_replace('/\D+/', '', (string) ($snapshot['phoneCountryCode'] ?? '').' '.($snapshot['phoneNumber'] ?? ''));

        return '+'.$digits;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function items(Order $order): array
    {
        return $order->items->map(fn ($item): array => [
            'reference_id' => (string) ($item->sku !== '' ? $item->sku : $item->product_rid),
            'title' => mb_substr((string) $item->product_name, 0, 200),
            'quantity' => max(1, (int) $item->quantity),
            'unit_price' => $this->major((int) $item->unit_price_minor),
            'category' => $item->product?->category?->label ?? 'General',
        ])->values()->all();
    }

    /**
     * @param  array<string, mixed>  $session
     */
    private function webUrl(array $session): string
    {
        $available = $session['configuration']['available_products']['installments'] ?? null;
        $list = is_array($available) && array_is_list($available) ? $available : [$available];

        foreach ($list as $product) {
            if (is_array($product) && is_string($product['web_url'] ?? null) && $product['web_url'] !== '') {
                return $product['web_url'];
            }
        }

        return '';
    }

    private function verifySignature(Request $request): void
    {
        $expected = (string) config('payments.providers.tabby.webhook_key');
        if ($expected === '') {
            Log::warning('Tabby webhook arrived without a configured signing key; relying on API re-verification.');

            return;
        }

        $actual = (string) $request->header('X-Webhook-Key', '');
        if ($actual === '' || ! hash_equals($expected, $actual)) {
            throw new RuntimeException('Invalid Tabby webhook signature.');
        }
    }

    private function major(int $minor): string
    {
        return number_format($minor / 100, 2, '.', '');
    }

    private function toMinor(mixed $value): ?int
    {
        return is_numeric($value) ? (int) round(((float) $value) * 100) : null;
    }
}
