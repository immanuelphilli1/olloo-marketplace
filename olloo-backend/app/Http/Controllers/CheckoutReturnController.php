<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Payments\PaymentGatewayManager;
use App\Services\PaymentSettlementService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

/**
 * Lands the shopper after a gateway redirect.
 *
 * The gateway sends them here (one path per provider, e.g.
 * /checkout/return/stripe). We own this hop so the storefront gets a decision
 * it can render, and so the browser is never the thing we trust: the payment is
 * re-checked against the provider before the redirect, keyed on our own
 * reference that we appended to the URL rather than anything the provider
 * echoed back.
 *
 * Public on purpose: the shopper may not hold a session, and this is a browser
 * navigation from the provider, not an API call. It reveals nothing the
 * reference does not already grant.
 */
final class CheckoutReturnController extends Controller
{
    public function __construct(
        private readonly PaymentGatewayManager $gateways,
        private readonly PaymentSettlementService $settlement,
    ) {}

    public function success(Request $request, string $provider): RedirectResponse
    {
        $payment = $this->resolvePayment($request, $provider);

        if (! $payment instanceof Payment) {
            // Nothing to look up, so the reference is not echoed back: the
            // storefront only ever sees values we resolved ourselves.
            return $this->toStorefront($this->storefrontUrl('return_path'), [
                'provider' => $provider,
                'status' => 'unknown',
            ]);
        }

        $payment = $this->verify($payment);

        $money = money((int) $payment->amount_minor, (string) $payment->currency_code);

        return $this->toStorefront($this->storefrontUrl('return_path'), [
            'reference' => $payment->rid,
            'provider' => $payment->provider,
            'status' => $payment->status,
            'orderId' => $payment->order?->rid,
            'orderReference' => $payment->order?->order_reference,
            'amount' => (string) ($money['amount'] ?? ''),
            'currency' => (string) ($money['currency'] ?? ''),
        ]);
    }

    public function cancel(Request $request, string $provider): RedirectResponse
    {
        $payment = $this->resolvePayment($request, $provider);

        return $this->toStorefront($this->storefrontUrl('cancel_path'), [
            'provider' => $provider,
            'status' => 'cancelled',
            'reference' => $payment?->rid,
            'orderId' => $payment?->order?->rid,
        ]);
    }

    /**
     * Find the payment our own reference points at, and refuse to hand one
     * provider's shopper another provider's payment.
     */
    private function resolvePayment(Request $request, string $provider): ?Payment
    {
        if (config("payments.providers.{$provider}") === null) {
            abort(api_error('payment_provider_error', "Unknown payment provider [{$provider}].", 404));
        }

        $reference = $this->cleanReference($request->query('reference'));
        if ($reference === '') {
            return null;
        }

        return Payment::query()
            ->where('provider', $provider)
            ->where(function ($query) use ($reference): void {
                $query->where('rid', $reference)
                    ->orWhere('external_reference', $reference);
            })
            ->first();
    }

    /**
     * Re-check with the provider so the shopper sees the real outcome now rather
     * than waiting on a webhook. A provider outage must not strand them on our
     * domain, so a failure falls through to the status we already hold.
     */
    private function verify(Payment $payment): Payment
    {
        $verifyReference = is_string($payment->external_reference) && $payment->external_reference !== ''
            ? $payment->external_reference
            : $payment->rid;

        try {
            $charge = $this->gateways->gateway($payment->provider)->verifyCharge($verifyReference);
            $this->settlement->applyVerifiedCharge($payment, $charge);
        } catch (Throwable $e) {
            Log::warning('Checkout return could not verify payment with provider', [
                'payment_rid' => $payment->rid,
                'provider' => $payment->provider,
                'message' => $e->getMessage(),
            ]);
        }

        return $payment->fresh() ?? $payment;
    }

    /**
     * The redirect target is always our configured storefront plus a fixed set
     * of values, never anything else from the query string, so this cannot be
     * turned into an open redirect.
     *
     * @param  array<string, string|null>  $params
     */
    private function toStorefront(string $base, array $params): RedirectResponse
    {
        $query = array_filter($params, fn (?string $value): bool => $value !== null && $value !== '');

        return redirect()->away($query === [] ? $base : $base.'?'.http_build_query($query));
    }

    /**
     * Storefront base plus one of its paths. The base must be configured and
     * absolute: guessing a host would drop the shopper on the wrong site with a
     * payment result they cannot check.
     */
    private function storefrontUrl(string $pathKey): string
    {
        $base = rtrim(trim((string) config('services.storefront.url')), '/');
        $path = trim((string) config("services.storefront.{$pathKey}"));

        if ($base === '' || ! Str::startsWith($base, ['http://', 'https://'])) {
            throw new RuntimeException(
                'WEB_CLIENT_URL must be an absolute http(s) URL so the storefront can be sent the payment result.'
            );
        }

        return $path === '' ? $base : $base.'/'.ltrim($path, '/');
    }

    /**
     * Rids and provider references only. Anything else is discarded rather than
     * reflected into the redirect.
     */
    private function cleanReference(mixed $reference): string
    {
        $reference = is_string($reference) ? trim($reference) : '';

        return Str::length($reference) <= 64 && preg_match('/^[A-Za-z0-9_.:-]+$/', $reference) === 1
            ? $reference
            : '';
    }
}
