<?php

declare(strict_types=1);

namespace App\Payments\Gateways;

use App\Models\Payment;
use App\Payments\Contracts\PaymentGateway;
use App\Payments\DTOs\CheckoutRequest;
use App\Payments\DTOs\CheckoutSession;
use App\Payments\DTOs\VerifiedCharge;
use App\Payments\DTOs\WebhookEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Local/test provider. Behaves like a real one: a charge succeeds for exactly
 * the amount and currency of the payment it was opened for, so settlement's
 * amount checks run in tests too. Refuses to run in production.
 */
final class FakeGateway implements PaymentGateway
{
    public function __construct()
    {
        if (app()->environment('production')) {
            throw new RuntimeException('The fake payment provider cannot be used in production. Set the currency payment_provider to stripe or paystack.');
        }
    }

    public function key(): string
    {
        return 'fake';
    }

    public function createCheckout(CheckoutRequest $request): CheckoutSession
    {
        $reference = $request->reference !== ''
            ? $request->reference
            : 'fake_'.Str::lower((string) Str::ulid());

        return new CheckoutSession(
            provider: $this->key(),
            reference: $reference,
            checkoutUrl: 'https://payments.test/fake-checkout/'.$reference,
            raw: [
                'fake' => true,
                'amount_minor' => $request->amountMinor,
                'currency_code' => $request->currencyCode,
            ],
        );
    }

    public function parseWebhook(Request $request): WebhookEvent
    {
        $decoded = $request->json()->all();
        /** @var array<string, mixed> $payload */
        $payload = is_array($decoded) ? $decoded : [];

        $reference = is_string($payload['reference'] ?? null) ? $payload['reference'] : null;
        $eventType = is_string($payload['event'] ?? null) ? $payload['event'] : 'charge.success';
        $externalEventId = is_string($payload['id'] ?? null) && $payload['id'] !== ''
            ? $payload['id']
            : 'fake_'.hash('sha256', $request->getContent().'|'.($reference ?? ''));

        $paid = ! array_key_exists('paid', $payload) || (bool) $payload['paid'];

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
        $payment = Payment::query()
            ->where('provider', $this->key())
            ->where(fn ($query) => $query->where('external_reference', $externalReference)->orWhere('rid', $externalReference))
            ->first();

        // A real provider has no charge for an unknown reference.
        if (! $payment instanceof Payment) {
            return new VerifiedCharge(
                externalReference: $externalReference,
                status: 'failed',
                paid: false,
            );
        }

        return new VerifiedCharge(
            externalReference: $externalReference,
            status: 'success',
            paid: true,
            amountMinor: (int) $payment->amount_minor,
            currencyCode: (string) $payment->currency_code,
        );
    }
}
