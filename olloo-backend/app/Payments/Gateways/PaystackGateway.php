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

final class PaystackGateway implements PaymentGateway
{
    use LogsProviderRequests;

    public function __construct(
        private readonly ExternalRequestLogger $requestLogger,
    ) {}

    public function key(): string
    {
        return 'paystack';
    }

    private function request(
        string $method,
        string $path,
        ?array $body,
        string $action,
        ?string $paymentKey = null,
    ): Response {
        $baseUrl = rtrim((string) config('payments.providers.paystack.base_url', 'https://api.paystack.co'), '/');
        $token = (string) config('payments.providers.paystack.secret_key');

        return $this->loggedRequest(
            service: 'paystack',
            method: $method,
            url: $baseUrl.$path,
            headers: ['Authorization' => 'Bearer '.$token],
            body: $body,
            action: $action,
            paymentKey: $paymentKey,
            // Paystack answers HTTP 200 with `status: false` for a refused
            // charge, so the envelope decides, not the transport.
            envelopeSuccessKey: 'status',
        );
    }

    public function createCheckout(CheckoutRequest $request): CheckoutSession
    {
        $this->assertConfigured();

        $amount = max(1, $request->amountMinor);
        $currency = strtoupper($request->currencyCode);

        $payload = [
            'email' => $request->customerEmail,
            'amount' => $amount,
            'currency' => $currency,
            'reference' => $request->reference,
            'callback_url' => $request->returnUrl,
            'metadata' => array_merge([
                'payment_rid' => $request->reference,
                'currency_code' => $currency,
                'cancel_action' => $request->cancelReturnUrl,
            ], $request->metadata),
        ];

        $response = $this->request(
            'POST',
            '/transaction/initialize',
            $payload,
            'transaction.initialize',
            $request->reference,
        );

        if (! $response->successful() || $response->json('status') !== true) {
            Log::warning('Paystack transaction initialize failed', [
                'status' => $response->status(),
                'body' => $response->body(),
                'reference' => $request->reference,
            ]);

            throw new RuntimeException(
                'Paystack initialize failed: '.(string) $response->json('message', $response->body())
            );
        }

        /** @var array<string, mixed> $data */
        $data = is_array($response->json('data')) ? $response->json('data') : [];
        $checkoutUrl = is_string($data['authorization_url'] ?? null) ? $data['authorization_url'] : '';
        if ($checkoutUrl === '') {
            throw new RuntimeException('Paystack initialize response missing authorization_url.');
        }

        $reference = is_string($data['reference'] ?? null) && $data['reference'] !== ''
            ? $data['reference']
            : $request->reference;

        return new CheckoutSession(
            provider: $this->key(),
            reference: $reference,
            checkoutUrl: $checkoutUrl,
            raw: $data,
        );
    }

    public function parseWebhook(Request $request): WebhookEvent
    {
        $secret = (string) (
            config('payments.providers.paystack.webhook_secret')
            ?: config('payments.providers.paystack.secret_key')
        );

        if ($secret === '') {
            throw new RuntimeException('Paystack is not configured (PAYSTACK_SECRET_KEY / PAYSTACK_WEBHOOK_SECRET).');
        }

        $raw = $request->getContent();
        $signature = (string) $request->header('x-paystack-signature', '');
        $expected = hash_hmac('sha512', $raw, $secret);

        if ($signature === '' || ! hash_equals($expected, $signature)) {
            throw new RuntimeException('Invalid Paystack webhook signature.');
        }

        $decoded = json_decode($raw, true);
        /** @var array<string, mixed> $payload */
        $payload = is_array($decoded) ? $decoded : [];
        $eventType = is_string($payload['event'] ?? null) ? $payload['event'] : 'unknown';
        /** @var array<string, mixed> $data */
        $data = is_array($payload['data'] ?? null) ? $payload['data'] : [];

        $reference = is_string($data['reference'] ?? null) && $data['reference'] !== ''
            ? $data['reference']
            : null;

        if (isset($data['id']) && (is_string($data['id']) || is_int($data['id']))) {
            $externalEventId = $eventType.':'.$data['id'];
        } elseif ($reference !== null) {
            $externalEventId = $eventType.':'.$reference;
        } else {
            $externalEventId = $eventType.':'.hash('sha256', $raw);
        }

        $status = is_string($data['status'] ?? null) ? strtolower($data['status']) : '';
        $paid = in_array($eventType, ['charge.success', 'paymentrequest.success'], true)
            || in_array($status, ['success', 'successful'], true);

        return new WebhookEvent(
            provider: $this->key(),
            externalEventId: $externalEventId,
            eventType: $eventType,
            reference: $reference,
            payload: $payload,
            paid: $paid,
        );
    }

    public function verifyCharge(string $externalReference): VerifiedCharge
    {
        $this->assertConfigured();

        $reference = trim($externalReference);
        if ($reference === '') {
            throw new RuntimeException('Paystack verify requires a transaction reference.');
        }

        $response = $this->request(
            'GET',
            '/transaction/verify/'.rawurlencode($reference),
            null,
            'transaction.verify',
            $reference,
        );

        if (! $response->successful() || $response->json('status') !== true) {
            Log::warning('Paystack transaction verify failed', [
                'status' => $response->status(),
                'body' => $response->body(),
                'reference' => $reference,
            ]);

            throw new RuntimeException(
                'Paystack verify failed: '.(string) $response->json('message', $response->body())
            );
        }

        /** @var array<string, mixed> $data */
        $data = is_array($response->json('data')) ? $response->json('data') : [];
        $status = is_string($data['status'] ?? null) ? strtolower($data['status']) : 'unknown';
        $ref = is_string($data['reference'] ?? null) && $data['reference'] !== ''
            ? $data['reference']
            : $reference;

        return new VerifiedCharge(
            externalReference: $ref,
            status: $status,
            paid: $status === 'success',
            amountMinor: isset($data['amount']) && is_numeric($data['amount']) ? (int) $data['amount'] : null,
            currencyCode: is_string($data['currency'] ?? null) ? strtoupper($data['currency']) : null,
        );
    }

    private function assertConfigured(): void
    {
        if ((string) config('payments.providers.paystack.secret_key') === '') {
            throw new RuntimeException('Paystack is not configured (PAYSTACK_SECRET_KEY).');
        }
    }
}
