<?php

declare(strict_types=1);

namespace App\Payments\Gateways;

use App\Models\Payment;
use App\Payments\Concerns\LogsProviderRequests;
use App\Payments\Contracts\PaymentGateway;
use App\Payments\DTOs\CheckoutRequest;
use App\Payments\DTOs\CheckoutSession;
use App\Payments\DTOs\VerifiedCharge;
use App\Payments\DTOs\WebhookEvent;
use App\Services\ExternalRequestLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * PayPal Orders API v2: create order, buyer approves on paypal.com, we
 * capture, webhooks confirm. Stripe cannot process PayPal, so this driver
 * exists alongside it.
 */
final class PaypalGateway implements PaymentGateway
{
    use LogsProviderRequests;

    public function __construct(
        private readonly ExternalRequestLogger $requestLogger,
    ) {}

    public function key(): string
    {
        return 'paypal';
    }

    public function createCheckout(CheckoutRequest $request): CheckoutSession
    {
        $token = $this->accessToken();
        $currency = strtoupper($request->currencyCode);

        $response = $this->loggedRequest(
            'paypal',
            'POST',
            $this->base().'/v2/checkout/orders',
            ['Authorization' => 'Bearer '.$token, 'Content-Type' => 'application/json'],
            [
                'intent' => 'CAPTURE',
                'purchase_units' => [[
                    'reference_id' => $request->reference,
                    'custom_id' => $request->reference,
                    'amount' => [
                        'currency_code' => $currency,
                        'value' => $this->major($request->amountMinor),
                    ],
                ]],
                'application_context' => [
                    'brand_name' => (string) config('app.name', 'H&CO'),
                    'return_url' => $request->returnUrl,
                    'cancel_url' => $request->cancelReturnUrl,
                ],
            ],
            'orders.create',
            $request->reference,
        );

        /** @var array<string, mixed> $order */
        $order = is_array($response->json()) ? $response->json() : [];
        $orderId = is_string($order['id'] ?? null) ? $order['id'] : '';
        $approveUrl = $this->approveLink($order);

        if (! $response->successful() || $orderId === '' || $approveUrl === '') {
            Log::warning('PayPal order create failed', ['status' => $response->status(), 'reference' => $request->reference]);
            throw new RuntimeException('PayPal order failed: '.mb_substr($response->body(), 0, 200));
        }

        return new CheckoutSession(
            provider: $this->key(),
            reference: $orderId,
            checkoutUrl: $approveUrl,
            raw: $order,
        );
    }

    /**
     * Capture an approved order. Idempotent per payment via PayPal-Request-Id.
     */
    public function captureOrder(string $payPalOrderId, string $paymentRid): void
    {
        $token = $this->accessToken();

        $response = $this->loggedRequest(
            'paypal',
            'POST',
            $this->base().'/v2/checkout/orders/'.rawurlencode($payPalOrderId).'/capture',
            [
                'Authorization' => 'Bearer '.$token,
                'Content-Type' => 'application/json',
                'PayPal-Request-Id' => $paymentRid,
            ],
            [],
            'orders.capture',
            $paymentRid,
        );

        if ($response->successful()) {
            return;
        }

        // Already captured (e.g. retried job): nothing left to do.
        if (str_contains($response->body(), 'ORDER_ALREADY_CAPTURED')) {
            return;
        }

        Log::warning('PayPal capture failed', ['status' => $response->status(), 'order' => $payPalOrderId]);
        throw new RuntimeException('PayPal capture failed: '.mb_substr($response->body(), 0, 200));
    }

    public function parseWebhook(Request $request): WebhookEvent
    {
        $this->assertConfigured();
        $this->verifySignature($request);

        $decoded = json_decode($request->getContent(), true);
        /** @var array<string, mixed> $payload */
        $payload = is_array($decoded) ? $decoded : [];
        $eventType = is_string($payload['event_type'] ?? null) ? $payload['event_type'] : 'unknown';
        /** @var array<string, mixed> $resource */
        $resource = is_array($payload['resource'] ?? null) ? $payload['resource'] : [];

        $reference = $this->extractReference($resource);
        $paid = $eventType === 'PAYMENT.CAPTURE.COMPLETED';

        $eventId = is_string($payload['id'] ?? null) && $payload['id'] !== ''
            ? 'paypal:'.((string) $payload['id'])
            : 'paypal:'.hash('sha256', $request->getContent());

        return new WebhookEvent(
            provider: $this->key(),
            externalEventId: $eventId,
            eventType: $eventType,
            reference: $reference,
            payload: $payload,
            paid: $paid,
        );
    }

    public function verifyCharge(string $externalReference): VerifiedCharge
    {
        $orderId = $this->orderIdFor($externalReference);

        $response = $this->loggedRequest(
            'paypal',
            'GET',
            $this->base().'/v2/checkout/orders/'.rawurlencode($orderId),
            ['Authorization' => 'Bearer '.$this->accessToken()],
            null,
            'orders.get',
            $externalReference,
        );

        if (! $response->successful()) {
            throw new RuntimeException('PayPal verify failed: '.mb_substr($response->body(), 0, 200));
        }

        /** @var array<string, mixed> $order */
        $order = is_array($response->json()) ? $response->json() : [];
        $units = is_array($order['purchase_units'] ?? null) ? $order['purchase_units'] : [];
        $payments = is_array($units[0]['payments']['captures'] ?? null) ? $units[0]['payments']['captures'] : [];

        foreach ($payments as $capture) {
            if (! is_array($capture) || strtolower((string) ($capture['status'] ?? '')) !== 'completed') {
                continue;
            }
            $amount = is_array($capture['amount'] ?? null) ? $capture['amount'] : [];

            return new VerifiedCharge(
                externalReference: $orderId,
                status: 'completed',
                paid: true,
                amountMinor: $this->toMinor($amount['value'] ?? null),
                currencyCode: is_string($amount['currency_code'] ?? null) ? strtoupper($amount['currency_code']) : null,
            );
        }

        return new VerifiedCharge(
            externalReference: $orderId,
            status: strtolower((string) ($order['status'] ?? 'unknown')),
            paid: false,
        );
    }

    private function base(): string
    {
        return config('payments.providers.paypal.sandbox', true)
            ? 'https://api-m.sandbox.paypal.com'
            : 'https://api-m.paypal.com';
    }

    private function accessToken(): string
    {
        $this->assertConfigured();

        return Cache::remember('paypal.access_token.'.md5((string) config('payments.providers.paypal.client_id')), 28000, function (): string {
            $response = $this->loggedRequest(
                'paypal',
                'POST',
                $this->base().'/v1/oauth2/token',
                [
                    'Authorization' => 'Basic '.base64_encode(
                        config('payments.providers.paypal.client_id').':'.config('payments.providers.paypal.secret')
                    ),
                ],
                ['grant_type' => 'client_credentials'],
                'oauth.token',
                null,
                true,
            );

            $token = is_array($response->json()) ? ($response->json('access_token') ?? null) : null;
            if (! $response->successful() || ! is_string($token) || $token === '') {
                throw new RuntimeException('PayPal auth failed: '.mb_substr($response->body(), 0, 200));
            }

            return $token;
        });
    }

    /**
     * @param  array<string, mixed>  $order
     */
    private function approveLink(array $order): string
    {
        $links = is_array($order['links'] ?? null) ? $order['links'] : [];
        foreach ($links as $link) {
            if (is_array($link) && ($link['rel'] ?? null) === 'approve' && is_string($link['href'] ?? null)) {
                return $link['href'];
            }
        }

        return '';
    }

    /**
     * @param  array<string, mixed>  $resource
     */
    private function extractReference(array $resource): ?string
    {
        foreach ([
            $resource['custom_id'] ?? null,
            is_array($resource['supplementary_data'] ?? null)
                ? (is_array($resource['supplementary_data']['related_ids'] ?? null)
                    ? ($resource['supplementary_data']['related_ids']['order_id'] ?? null)
                    : null)
                : null,
            $resource['id'] ?? null,
        ] as $candidate) {
            if (is_string($candidate) && $candidate !== '') {
                return $candidate;
            }
        }

        return null;
    }

    private function orderIdFor(string $externalReference): string
    {
        $key = trim($externalReference);
        if ($key === '') {
            throw new RuntimeException('PayPal verify requires an order id.');
        }

        $payment = Payment::query()
            ->where('rid', $key)
            ->orWhere('external_reference', $key)
            ->first();

        if ($payment instanceof Payment
            && is_string($payment->external_reference)
            && $payment->external_reference !== '') {
            return $payment->external_reference;
        }

        return $key;
    }

    private function verifySignature(Request $request): void
    {
        $webhookId = (string) config('payments.providers.paypal.webhook_id');
        if ($webhookId === '') {
            throw new RuntimeException('PayPal webhook id is not configured (PAYPAL_WEBHOOK_ID).');
        }

        $response = $this->loggedRequest(
            'paypal',
            'POST',
            $this->base().'/v1/notifications/verify-webhook-signature',
            ['Authorization' => 'Bearer '.$this->accessToken(), 'Content-Type' => 'application/json'],
            [
                'transmission_id' => (string) $request->header('paypal-transmission-id', ''),
                'transmission_time' => (string) $request->header('paypal-transmission-time', ''),
                'cert_url' => (string) $request->header('paypal-cert-url', ''),
                'auth_algo' => (string) $request->header('paypal-auth-algo', ''),
                'transmission_sig' => (string) $request->header('paypal-transmission-sig', ''),
                'webhook_id' => $webhookId,
                'webhook_event' => json_decode($request->getContent(), true),
            ],
            'webhooks.verify',
        );

        if (! $response->successful() || strtoupper((string) $response->json('verification_status', '')) !== 'SUCCESS') {
            throw new RuntimeException('Invalid PayPal webhook signature.');
        }
    }

    private function assertConfigured(): void
    {
        if ((string) config('payments.providers.paypal.client_id') === ''
            || (string) config('payments.providers.paypal.secret') === '') {
            throw new RuntimeException('PayPal is not configured (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET).');
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
