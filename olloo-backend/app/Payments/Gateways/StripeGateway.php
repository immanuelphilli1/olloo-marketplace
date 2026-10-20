<?php

declare(strict_types=1);

namespace App\Payments\Gateways;

use App\Payments\Concerns\LogsProviderRequests;
use App\Payments\Contracts\PaymentGateway;
use App\Payments\DTOs\CheckoutRequest;
use App\Payments\DTOs\CheckoutSession;
use App\Payments\DTOs\VerifiedCharge;
use App\Payments\DTOs\WebhookEvent;
use App\Services\ExternalRequestLogger;
use Illuminate\Http\Client\Response;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Util\ApiVersion;
use Stripe\Webhook;
use UnexpectedValueException;

final class StripeGateway implements PaymentGateway
{
    use LogsProviderRequests;

    public function __construct(
        private readonly ExternalRequestLogger $requestLogger,
    ) {}

    public function key(): string
    {
        return 'stripe';
    }

    public function createCheckout(CheckoutRequest $request): CheckoutSession
    {
        $this->assertConfigured();

        $currency = strtolower($request->currencyCode);
        $amount = max(1, $request->amountMinor);

        $metadata = $this->stringifyMetadata(array_merge([
            'payment_rid' => $request->reference,
            'currency_code' => strtoupper($request->currencyCode),
        ], $request->metadata));

        $response = $this->loggedRequest(
            service: $this->key(),
            method: 'POST',
            url: $this->base().'/v1/checkout/sessions',
            headers: $this->headers(),
            body: [
                'mode' => 'payment',
                'success_url' => $this->appendQuery($request->returnUrl, [
                    'session_id' => '{CHECKOUT_SESSION_ID}',
                ]),
                'cancel_url' => $request->cancelReturnUrl,
                'client_reference_id' => $request->reference,
                'customer_email' => $request->customerEmail,
                'customer_creation' => 'always',
                'metadata' => $metadata,
                'line_items' => [[
                    'quantity' => 1,
                    'price_data' => [
                        'currency' => $currency,
                        'unit_amount' => $amount,
                        'product_data' => [
                            'name' => 'Order payment',
                        ],
                    ],
                ]],
                'payment_intent_data' => [
                    'metadata' => $metadata,
                ],
            ],
            action: 'checkout.sessions.create',
            paymentKey: $request->reference,
            // Stripe's API takes form encoding with bracket keys for nested
            // params (line_items[0][price_data][currency]).
            asForm: true,
        );

        $this->assertOk($response, 'checkout session create', $request->reference);

        /** @var array<string, mixed> $session */
        $session = is_array($response->json()) ? $response->json() : [];

        $checkoutUrl = is_string($session['url'] ?? null) ? $session['url'] : '';
        if ($checkoutUrl === '') {
            throw new RuntimeException('Stripe checkout session response missing url.');
        }

        $sessionId = is_string($session['id'] ?? null) ? $session['id'] : '';
        if ($sessionId === '') {
            throw new RuntimeException('Stripe checkout session response missing id.');
        }

        return new CheckoutSession(
            provider: $this->key(),
            reference: $sessionId,
            checkoutUrl: $checkoutUrl,
            raw: $session,
        );
    }

    public function parseWebhook(Request $request): WebhookEvent
    {
        $secret = config('payments.providers.stripe.webhook_secret');
        if (! is_string($secret) || $secret === '') {
            throw new RuntimeException('Stripe webhook secret is not configured (STRIPE_WEBHOOK_SECRET).');
        }

        $payload = $request->getContent();
        $signature = (string) $request->header('Stripe-Signature', '');

        try {
            $event = Webhook::constructEvent($payload, $signature, $secret);
        } catch (UnexpectedValueException|SignatureVerificationException $e) {
            throw new RuntimeException('Invalid Stripe webhook signature: '.$e->getMessage(), 0, $e);
        }

        /** @var array<string, mixed> $eventArray */
        $eventArray = $event->toArray();
        $object = is_array($eventArray['data']['object'] ?? null)
            ? $eventArray['data']['object']
            : [];

        $reference = $this->extractReference($object);
        $paid = $this->isPaidEvent((string) $event->type, $object);

        return new WebhookEvent(
            provider: $this->key(),
            externalEventId: (string) $event->id,
            eventType: (string) $event->type,
            reference: $reference,
            payload: $eventArray,
            paid: $paid,
        );
    }

    public function verifyCharge(string $externalReference): VerifiedCharge
    {
        $reference = trim($externalReference);

        if ($reference === '') {
            throw new RuntimeException('Stripe verify requires a checkout session or payment intent id.');
        }

        if (str_starts_with($reference, 'pi_')) {
            $response = $this->loggedRequest(
                service: $this->key(),
                method: 'GET',
                url: $this->base().'/v1/payment_intents/'.rawurlencode($reference),
                headers: $this->headers(),
                body: null,
                action: 'payment_intents.retrieve',
                paymentKey: $reference,
            );

            $this->assertOk($response, 'verify', $reference);

            return $this->verifyPaymentIntent(is_array($response->json()) ? $response->json() : []);
        }

        $response = $this->loggedRequest(
            service: $this->key(),
            method: 'GET',
            url: $this->base().'/v1/checkout/sessions/'.rawurlencode($reference).'?expand%5B0%5D=payment_intent',
            headers: $this->headers(),
            body: null,
            action: 'checkout.sessions.retrieve',
            paymentKey: $reference,
        );

        $this->assertOk($response, 'verify', $reference);

        return $this->verifyCheckoutSession(is_array($response->json()) ? $response->json() : []);
    }

    private function base(): string
    {
        return rtrim((string) config('payments.providers.stripe.base_url', 'https://api.stripe.com'), '/');
    }

    /**
     * The SDK used to send this implicitly. Pinning it ourselves keeps the REST
     * calls on the same field semantics the account would get from the library,
     * instead of silently drifting to whatever the dashboard default happens to
     * be on the day we deploy.
     *
     * @return array<string, string>
     */
    private function headers(): array
    {
        return [
            'Authorization' => 'Bearer '.$this->secret(),
            'Stripe-Version' => ApiVersion::CURRENT,
        ];
    }

    private function secret(): string
    {
        $secret = config('payments.providers.stripe.secret_key');
        if (! is_string($secret) || $secret === '') {
            throw new RuntimeException('Stripe is not configured (STRIPE_SECRET).');
        }

        return $secret;
    }

    private function assertConfigured(): void
    {
        $this->secret();
    }

    /**
     * Turn a non-2xx Stripe response into an exception. The failed call is
     * already in Request History by this point, so the message only has to name
     * the failure.
     */
    private function assertOk(Response $response, string $action, string $reference): void
    {
        if ($response->successful()) {
            return;
        }

        $message = $response->json('error.message');

        Log::warning('Stripe '.$action.' failed', [
            'status' => $response->status(),
            'message' => is_string($message) ? $message : $response->body(),
            'reference' => $reference,
        ]);

        throw new RuntimeException(sprintf(
            'Stripe %s failed (%d): %s',
            $action,
            $response->status(),
            is_string($message) ? $message : mb_substr($response->body(), 0, 300)
        ));
    }

    /**
     * @param  array<string, mixed>  $session
     */
    private function verifyCheckoutSession(array $session): VerifiedCharge
    {
        $paymentStatus = is_string($session['payment_status'] ?? null) ? strtolower($session['payment_status']) : 'unknown';
        $status = is_string($session['status'] ?? null) ? strtolower($session['status']) : $paymentStatus;
        $ref = is_string($session['id'] ?? null) && $session['id'] !== '' ? $session['id'] : '';

        // Amount and currency are read off the session even though we ask
        // Stripe to expand payment_intent: the session totals are the charge as
        // the shopper authorised it, and an unexpanded intent is only an id
        // string, so there would be nothing to fall back to.
        return new VerifiedCharge(
            externalReference: $ref !== '' ? $ref : (string) ($session['id'] ?? ''),
            status: $status,
            paid: $paymentStatus === 'paid',
            amountMinor: isset($session['amount_total']) ? (int) $session['amount_total'] : null,
            currencyCode: is_string($session['currency'] ?? null) ? strtoupper($session['currency']) : null,
        );
    }

    /**
     * @param  array<string, mixed>  $intent
     */
    private function verifyPaymentIntent(array $intent): VerifiedCharge
    {
        $status = is_string($intent['status'] ?? null) ? strtolower($intent['status']) : 'unknown';
        $ref = is_string($intent['id'] ?? null) && $intent['id'] !== '' ? $intent['id'] : '';

        return new VerifiedCharge(
            externalReference: $ref,
            status: $status,
            paid: $status === 'succeeded',
            amountMinor: isset($intent['amount']) ? (int) $intent['amount'] : null,
            currencyCode: is_string($intent['currency'] ?? null) ? strtoupper($intent['currency']) : null,
        );
    }

    /**
     * @param  array<string, mixed>  $object
     */
    private function extractReference(array $object): ?string
    {
        foreach ([
            $object['client_reference_id'] ?? null,
            is_array($object['metadata'] ?? null) ? ($object['metadata']['payment_rid'] ?? null) : null,
            $object['id'] ?? null,
        ] as $candidate) {
            if (is_string($candidate) && $candidate !== '') {
                return $candidate;
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $object
     */
    private function isPaidEvent(string $eventType, array $object): bool
    {
        if (in_array($eventType, ['checkout.session.completed', 'payment_intent.succeeded'], true)) {
            if ($eventType === 'checkout.session.completed') {
                $paymentStatus = is_string($object['payment_status'] ?? null)
                    ? strtolower($object['payment_status'])
                    : '';

                return $paymentStatus === 'paid' || $paymentStatus === '';
            }

            return true;
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $metadata
     * @return array<string, string>
     */
    private function stringifyMetadata(array $metadata): array
    {
        $out = [];
        foreach ($metadata as $key => $value) {
            if (! is_string($key) || $key === '') {
                continue;
            }
            if (is_scalar($value) || $value === null) {
                $out[$key] = (string) $value;

                continue;
            }
            $encoded = json_encode($value);
            if (is_string($encoded)) {
                $out[$key] = $encoded;
            }
        }

        return $out;
    }

    /**
     * @param  array<string, string>  $query
     */
    private function appendQuery(string $url, array $query): string
    {
        $separator = str_contains($url, '?') ? '&' : '?';
        $parts = [];
        foreach ($query as $key => $value) {
            $parts[] = rawurlencode($key).'='.$value;
        }

        return $url.$separator.implode('&', $parts);
    }
}
