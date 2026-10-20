<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\Payment;
use App\Payments\CurrencyGatewayResolver;
use App\Payments\DTOs\CheckoutRequest;
use App\Payments\PaymentGatewayManager;
use Illuminate\Support\Str;
use RuntimeException;

final class CheckoutPaymentService
{
    public function __construct(
        private readonly PaymentGatewayManager $gateways,
        private readonly CurrencyGatewayResolver $currencyResolver,
        private readonly PaymentMethodResolver $methodResolver,
    ) {}

    /**
     * Create a pending payment for an order and open a provider checkout session.
     *
     * Return URLs default to the resolved provider's own config
     * (`payments.providers.{provider}.return_url`), because each gateway
     * redirects the shopper back on its own and does not share a page. Pass them
     * explicitly only to override that, e.g. in tests.
     *
     * @param  array<string, mixed>  $metadata
     */
    public function initiate(
        Order $order,
        string $customerEmail,
        ?string $returnUrl = null,
        ?string $cancelReturnUrl = null,
        ?string $providerOverride = null,
        array $metadata = [],
        ?string $paymentMethodRef = null,
    ): Payment {
        return $this->createCheckoutPayment(
            amountMinor: (int) $order->total_minor,
            currencyCode: (string) $order->currency_code,
            userId: $order->user_id,
            orderId: $order->id,
            customerEmail: $customerEmail,
            returnUrl: $returnUrl,
            cancelReturnUrl: $cancelReturnUrl,
            providerOverride: $providerOverride,
            metadata: array_merge([
                'order_rid' => $order->rid,
                'order_reference' => $order->order_reference,
            ], $metadata),
            paymentMethodRef: $paymentMethodRef,
        );
    }

    /**
     * @param  array<string, mixed>  $metadata
     */
    private function createCheckoutPayment(
        int $amountMinor,
        string $currencyCode,
        ?int $userId,
        ?int $orderId,
        string $customerEmail,
        ?string $returnUrl,
        ?string $cancelReturnUrl,
        ?string $providerOverride,
        array $metadata,
        ?string $paymentMethodRef = null,
    ): Payment {
        $currency = strtoupper(trim($currencyCode));
        $resolution = $this->methodResolver->resolve($paymentMethodRef, $currency);
        $provider = $providerOverride !== null && $providerOverride !== ''
            ? $this->currencyResolver->forCurrency($currency, $providerOverride)
            : $resolution['provider'];
        $method = $resolution['method'];

        $payment = Payment::query()->create([
            'order_id' => $orderId,
            'user_id' => $userId,
            'payment_method_id' => $method?->id,
            'provider' => $provider,
            'status' => PaymentStatus::Pending->value,
            'amount_minor' => $amountMinor,
            'currency_code' => $currency,
            'metadata' => $metadata !== [] ? $metadata : null,
        ]);

        // Deliberately outside any transaction. Two reasons, both learned the
        // hard way: a provider call inside one holds our rows open for the full
        // HTTP timeout, and its Request History row is written on the same
        // connection, so a rejection ("No active channel to process
        // transaction") rolls the log back with everything else and the only
        // trace of the attempt is a line in the application log nobody reads.
        // The outbound call happened; it must outlive our own rollback. The
        // pending payment is committed first so a provider outage still leaves
        // an attempt on record instead of nothing at all.
        $session = $this->gateways->gateway($provider)->createCheckout(new CheckoutRequest(
            customerEmail: $customerEmail,
            amountMinor: $amountMinor,
            currencyCode: $currency,
            reference: $payment->rid,
            returnUrl: self::withReference($this->absolute($returnUrl ?? $this->providerUrl($provider, 'return_url'), $provider), $payment->rid),
            cancelReturnUrl: self::withReference($this->absolute($cancelReturnUrl ?? $this->providerUrl($provider, 'cancel_return_url'), $provider), $payment->rid),
            metadata: array_merge([
                'payment_rid' => $payment->rid,
            ], $metadata),
        ));

        $payment->update([
            'external_reference' => $session->reference,
            'checkout_url' => $session->checkoutUrl,
        ]);

        return $payment->refresh();
    }

    /**
     * A provider's own return URL. Configured per gateway
     * (`STRIPE_RETURN_URL`, `PAYSTACK_RETURN_URL`, ...) because each one
     * redirects the shopper back differently and must never be inferred from a
     * shared default.
     */
    private function providerUrl(string $provider, string $key): string
    {
        $url = config("payments.providers.{$provider}.{$key}");
        $env = strtoupper($provider).'_'.strtoupper($key);

        if (! is_string($url) || trim($url) === '') {
            throw new RuntimeException("Payment provider [{$provider}] has no {$env} configured.");
        }

        return $url;
    }

    /**
     * Gateways redirect the shopper back themselves, so they all need an
     * absolute http(s) URL. Stripe rejects a relative one outright
     * ("Not a valid URL"), which is easy to hit because the configured default
     * is a path. A configured path is resolved against APP_URL; anything that is
     * still not absolute is a misconfiguration and fails loudly rather than
     * being guessed at, because a wrong host sends shoppers off-site and drops
     * the payment reference.
     */
    private function absolute(string $url, string $provider): string
    {
        $url = trim($url);

        if ($url === '') {
            throw new RuntimeException("Payment provider [{$provider}] has an empty return URL, so there is nowhere to send the shopper after payment.");
        }

        if (Str::startsWith($url, ['http://', 'https://'])) {
            return $url;
        }

        $base = rtrim(trim((string) config('app.url')), '/');

        if ($base === '' || ! Str::startsWith($base, ['http://', 'https://'])) {
            throw new RuntimeException("APP_URL must be an absolute http(s) URL to resolve the {$provider} return URL [{$url}].");
        }

        // Keep only the path, query and fragment: a bare "shop.example" with no
        // scheme would otherwise be appended to the base host.
        if (! Str::startsWith($url, ['/', '?', '#'])) {
            $url = '/'.ltrim($url, '/');
        }

        return $base.$url;
    }

    /**
     * Attach our payment reference to a return URL so the frontend can query
     * payment status straight from the redirect, without relying on any
     * provider to echo a reference back.
     */
    private static function withReference(string $url, string $reference): string
    {
        if ($url === '') {
            return $url;
        }

        $separator = str_contains($url, '?') ? '&' : '?';

        return $url.$separator.'reference='.urlencode($reference);
    }
}
