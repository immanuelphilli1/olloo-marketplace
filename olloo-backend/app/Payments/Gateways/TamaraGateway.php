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
use RuntimeException;

/**
 * Tamara pay-in-instalments (AE/SA/BH/KW/OM): checkout session, buyer
 * approves, we authorise then capture the full amount. Docs: docs.tamara.co.
 */
final class TamaraGateway implements PaymentGateway
{
    use LogsProviderRequests;

    public function __construct(
        private readonly ExternalRequestLogger $requestLogger,
    ) {}

    public function key(): string
    {
        return 'tamara';
    }

    public function createCheckout(CheckoutRequest $request): CheckoutSession
    {
        $this->assertConfigured();
        $order = $this->orderFor($request);
        $currency = strtoupper($request->currencyCode);

        if (! in_array($currency, ['SAR', 'AED', 'BHD', 'KWD', 'OMR'], true)) {
            throw new RuntimeException("Tamara does not support {$currency}.");
        }

        $user = $order->user;
        $snapshot = is_array($order->address_snapshot) ? $order->address_snapshot : [];
        $country = strtoupper((string) ($snapshot['countryCode'] ?? ''));
        [$firstName, $lastName] = $this->splitName((string) ($user?->name ?? 'Customer'));

        $response = $this->loggedRequest(
            'tamara',
            'POST',
            $this->base().'/checkout',
            ['Authorization' => 'Bearer '.config('payments.providers.tamara.api_token')],
            [
                'order_reference_id' => $order->order_reference,
                'total_amount' => ['amount' => $this->majorNumber((int) $request->amountMinor), 'currency' => $currency],
                'description' => mb_substr('Order '.$order->order_reference, 0, 256),
                'country_code' => $country !== '' ? $country : 'AE',
                'payment_type' => 'PAY_BY_INSTALMENTS',
                // Plan length; confirm the offered plans in sandbox.
                'instalments' => 4,
                'items' => $this->items($order, $currency),
                'consumer' => [
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'phone_number' => $this->phone($snapshot),
                    'email' => $request->customerEmail,
                ],
                'shipping_address' => [
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'line1' => (string) ($snapshot['addressLine'] ?? $snapshot['line1'] ?? ''),
                    'city' => (string) ($snapshot['city'] ?? ''),
                    'country_code' => $country !== '' ? $country : 'AE',
                ],
                'tax_amount' => ['amount' => $this->majorNumber((int) $order->tax_minor), 'currency' => $currency],
                'shipping_amount' => ['amount' => $this->majorNumber((int) $order->shipping_minor), 'currency' => $currency],
                'merchant_url' => [
                    'success' => $request->returnUrl,
                    'failure' => $request->cancelReturnUrl,
                    'cancel' => $request->cancelReturnUrl,
                ],
                'risk_assessment' => $this->riskAssessment($order),
            ],
            'checkout.create',
            $request->reference,
        );

        /** @var array<string, mixed> $session */
        $session = is_array($response->json()) ? $response->json() : [];
        $orderId = is_string($session['order_id'] ?? null) ? $session['order_id'] : '';
        $checkoutUrl = is_string($session['checkout_url'] ?? null) ? $session['checkout_url'] : '';

        if (! $response->successful() || $orderId === '' || $checkoutUrl === '') {
            Log::warning('Tamara checkout failed', ['status' => $response->status(), 'reference' => $request->reference]);
            throw new RuntimeException('Tamara checkout failed: '.mb_substr($response->body(), 0, 200));
        }

        return new CheckoutSession(
            provider: $this->key(),
            reference: $orderId,
            checkoutUrl: $checkoutUrl,
            raw: $session,
        );
    }

    /**
     * Authorise an approved order, then capture it in full. Already-captured
     * orders are left alone.
     */
    public function authoriseAndCapture(string $tamaraOrderId, int $amountMinor, string $currency, string $paymentRid): void
    {
        $details = $this->retrieveOrder($tamaraOrderId, $paymentRid);
        $status = strtolower((string) ($details['status'] ?? ''));

        if (in_array($status, ['fully_captured'], true)) {
            return;
        }

        if ($status === 'approved') {
            $response = $this->loggedRequest(
                'tamara',
                'POST',
                $this->base().'/orders/'.rawurlencode($tamaraOrderId).'/authorise',
                ['Authorization' => 'Bearer '.config('payments.providers.tamara.api_token')],
                [],
                'orders.authorise',
                $paymentRid,
            );

            if (! $response->successful()) {
                throw new RuntimeException('Tamara authorise failed: '.mb_substr($response->body(), 0, 200));
            }

            $status = strtolower((string) ($response->json('status', $status)));
            if ($status === 'fully_captured') {
                return;
            }
        }

        if ($status !== 'authorised') {
            Log::info('Tamara capture skipped: order not authorised', ['status' => $status, 'reference' => $paymentRid]);

            return;
        }

        $response = $this->loggedRequest(
            'tamara',
            'POST',
            $this->base().'/payments/capture',
            ['Authorization' => 'Bearer '.config('payments.providers.tamara.api_token')],
            [
                'order_id' => $tamaraOrderId,
                'total_amount' => ['amount' => $this->majorNumber($amountMinor), 'currency' => strtoupper($currency)],
                'shipping_info' => [
                    'shipped_at' => now()->toIso8601String(),
                    'shipping_company' => (string) config('app.name', 'HandCO'),
                ],
            ],
            'payments.capture',
            $paymentRid,
        );

        if (! $response->successful()) {
            Log::warning('Tamara capture failed', ['status' => $response->status(), 'reference' => $paymentRid]);
            throw new RuntimeException('Tamara capture failed: '.mb_substr($response->body(), 0, 200));
        }
    }

    public function parseWebhook(Request $request): WebhookEvent
    {
        $this->assertConfigured();
        $this->verifyToken($request);

        $decoded = json_decode($request->getContent(), true);
        /** @var array<string, mixed> $payload */
        $payload = is_array($decoded) ? $decoded : [];
        $eventType = is_string($payload['event_type'] ?? null) ? $payload['event_type'] : 'unknown';
        $orderId = is_string($payload['order_id'] ?? null) ? $payload['order_id'] : null;

        return new WebhookEvent(
            provider: $this->key(),
            externalEventId: 'tamara:'.($orderId ?? 'unknown').':'.$eventType,
            eventType: $eventType,
            reference: $orderId,
            payload: $payload,
            // Captured means Tamara holds the money for us. Approved still
            // needs authorise + capture (AuthoriseAndCaptureTamaraOrder).
            paid: $eventType === 'order_captured',
        );
    }

    public function verifyCharge(string $externalReference): VerifiedCharge
    {
        $details = $this->retrieveOrder(trim($externalReference), trim($externalReference));
        $status = strtolower((string) ($details['status'] ?? 'unknown'));
        $total = is_array($details['total_amount'] ?? null) ? $details['total_amount'] : [];
        $captured = is_array($details['captured_amount'] ?? null) ? $details['captured_amount'] : [];

        return new VerifiedCharge(
            externalReference: is_string($details['order_id'] ?? null) ? $details['order_id'] : trim($externalReference),
            status: $status,
            paid: $status === 'fully_captured',
            amountMinor: $this->toMinor($captured['amount'] ?? $total['amount'] ?? null),
            currencyCode: $this->upper($captured['currency'] ?? $total['currency'] ?? null),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function retrieveOrder(string $tamaraOrderId, ?string $paymentKey = null): array
    {
        $this->assertConfigured();

        if ($tamaraOrderId === '') {
            throw new RuntimeException('Tamara verify requires an order id.');
        }

        $response = $this->loggedRequest(
            'tamara',
            'GET',
            $this->base().'/orders/'.rawurlencode($tamaraOrderId),
            ['Authorization' => 'Bearer '.config('payments.providers.tamara.api_token')],
            null,
            'orders.get',
            $paymentKey,
        );

        if (! $response->successful()) {
            throw new RuntimeException('Tamara retrieve failed: '.mb_substr($response->body(), 0, 200));
        }

        /** @var array<string, mixed> $order */
        $order = is_array($response->json()) ? $response->json() : [];

        return $order;
    }

    private function base(): string
    {
        return rtrim((string) config('payments.providers.tamara.base_url', 'https://api-sandbox.tamara.co'), '/');
    }

    private function assertConfigured(): void
    {
        if ((string) config('payments.providers.tamara.api_token') === '') {
            throw new RuntimeException('Tamara is not configured (TAMARA_API_TOKEN).');
        }
    }

    private function orderFor(CheckoutRequest $request): Order
    {
        $orderRid = is_array($request->metadata) ? ($request->metadata['order_rid'] ?? null) : null;

        $order = is_string($orderRid) && $orderRid !== ''
            ? Order::query()->where('rid', $orderRid)->with(['items.product.category', 'user'])->first()
            : null;

        if (! $order instanceof Order) {
            throw new RuntimeException('Tamara checkout needs its order (missing order_rid).');
        }

        return $order;
    }

    /**
     * Tamara signs each notification as a JWT (HS256) with the notification
     * token, sent as ?tamaraToken= and as the Bearer token. Forged events are
     * harmless anyway: settlement re-reads the order via API before paying.
     */
    private function verifyToken(Request $request): void
    {
        $secret = (string) config('payments.providers.tamara.notification_token');
        if ($secret === '') {
            Log::warning('Tamara webhook arrived without a configured notification token; relying on API re-verification.');

            return;
        }

        $token = trim((string) $request->query('tamaraToken', ''));
        if ($token === '') {
            $bearer = (string) $request->header('Authorization', '');
            $token = str_starts_with(strtolower($bearer), 'bearer ') ? trim(substr($bearer, 7)) : '';
        }

        $parts = explode('.', $token);
        if (count($parts) !== 3
            || ! hash_equals(
                rtrim(strtr(base64_encode(hash_hmac('sha256', $parts[0].'.'.$parts[1], $secret, true)), '+/', '-_'), '='),
                $parts[2]
            )) {
            throw new RuntimeException('Invalid Tamara webhook token.');
        }
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
        $digits = preg_replace('/\D+/', '', (string) ($snapshot['phoneCountryCode'] ?? '').($snapshot['phoneNumber'] ?? ''));

        if ($digits === '') {
            throw new RuntimeException('Tamara needs the shopper phone number on the order address.');
        }

        return $digits;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function items(Order $order, string $currency): array
    {
        return $order->items->map(fn ($item): array => [
            'reference_id' => (string) ($item->sku !== '' ? $item->sku : $item->product_rid),
            'type' => 'Physical',
            'name' => mb_substr((string) $item->product_name, 0, 255),
            'sku' => mb_substr((string) ($item->sku !== '' ? $item->sku : $item->product_rid), 0, 128),
            'quantity' => max(1, (int) $item->quantity),
            'total_amount' => [
                'amount' => $this->majorNumber((int) $item->unit_price_minor * max(1, (int) $item->quantity)),
                'currency' => $currency,
            ],
        ])->values()->all();
    }

    private function riskAssessment(Order $order): array
    {
        $user = $order->user;
        $created = $user?->created_at ?? $order->created_at ?? now();
        $orders = $user
            ? Order::query()->where('user_id', $user->id)->orderBy('id')
            : Order::query()->where('id', $order->id)->orderBy('id');
        $first = $orders->clone()->first();
        $last = (clone $orders)->orderByDesc('id')->first();

        return [
            'is_premium_customer' => false,
            'account_creation_date' => $created->format('d-m-Y'),
            'total_order_count' => $orders->clone()->count(),
            'date_first_paid' => ($first?->placed_at ?? $first?->created_at ?? $created)->format('d-m-Y'),
            'date_last_paid' => ($last?->placed_at ?? $last?->created_at ?? $created)->format('d-m-Y'),
        ];
    }

    private function majorNumber(int $minor): float
    {
        return round($minor / 100, 2);
    }

    private function toMinor(mixed $value): ?int
    {
        return is_numeric($value) ? (int) round(((float) $value) * 100) : null;
    }

    private function upper(mixed $value): ?string
    {
        return is_string($value) && $value !== '' ? strtoupper($value) : null;
    }
}
