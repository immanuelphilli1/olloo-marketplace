<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\PaymentMethod;
use App\Payments\CurrencyGatewayResolver;
use Illuminate\Support\Collection;

/**
 * Routes a checkout to a provider by payment method plus currency.
 *
 * - With a method (rid or code): the method must exist, be active, and serve
 *   the order currency (and market, when known). Its provider wins.
 * - Without one: the previous behaviour, the currency row's provider.
 */
final class PaymentMethodResolver
{
    public function __construct(
        private readonly CurrencyGatewayResolver $currencyResolver,
    ) {}

    /**
     * Methods that can actually pay `$currency`.
     *
     * Two passes. The first is the rows scoped to this market. The second is the
     * fallback rows, returned only when the first found nothing, so a shopper in
     * a market we have not configured can still pay instead of dead-ending on an
     * empty list. A fallback is never offered alongside a scoped option: these
     * rows exist to cover the gap, not to clutter the common case.
     *
     * The fallback rows clear the same gates as a scoped row, currency and
     * market included, so a fallback can never widen the list into something the
     * cart cannot settle with. That is what keeps a GHS cart off a Stripe row:
     * the USD rows do not list GHS, so they are not a candidate whatever their
     * country list says. A row claiming a currency its own gateway cannot carry
     * is a data mistake, and the seeder re-asserts both fields on every deploy.
     *
     * Currency is required, not optional. A currency always resolves (the
     * shopper's own, else the store default), so accepting null here would only
     * ever mean "caller forgot", and answering that with every active method
     * shows the shopper options their order cannot pay with.
     *
     * Country is the shopper's *market*, not where the parcel goes. Shipping
     * somewhere else must not change how the shopper pays: a UAE card pays an
     * order shipping to Ghana perfectly well, and filtering on the delivery
     * destination is what emptied the list for anyone crossing a market border.
     * Null, a market we cannot place, rules nothing out.
     *
     * @return Collection<int, PaymentMethod>
     */
    public function available(string $currency, ?string $country = null): Collection
    {
        $active = PaymentMethod::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('label')
            ->get();

        $scoped = $active
            ->reject(fn (PaymentMethod $method): bool => (bool) $method->is_fallback)
            ->filter(fn (PaymentMethod $method): bool => $method->supports($currency, $country))
            ->values();

        if ($scoped->isNotEmpty()) {
            return $scoped;
        }

        return $active
            ->filter(fn (PaymentMethod $method): bool => (bool) $method->is_fallback
                && $method->supports($currency, $country))
            ->values();
    }

    /**
     * @return array{method: ?PaymentMethod, provider: string}
     */
    public function resolve(?string $methodRef, string $currency, ?string $country = null, ?string $providerOverride = null): array
    {
        $methodRef = is_string($methodRef) ? trim($methodRef) : '';

        if ($methodRef === '') {
            return [
                'method' => null,
                'provider' => $this->currencyResolver->forCurrency($currency, $providerOverride),
            ];
        }

        $method = PaymentMethod::query()
            ->where('rid', $methodRef)
            ->orWhere('code', $methodRef)
            ->first();

        if (! $method instanceof PaymentMethod) {
            abort(api_error('payment_method_not_found', 'Payment method not found.', 404));
        }

        // Deliberately the same check available() runs. The preview is what put
        // this method in front of the shopper, so it must be payable by the time
        // they reach for it; they previously disagreed, because the list filtered
        // on the delivery destination and this did not.
        if (! $method->supports($currency, $country)) {
            abort(api_error('payment_method_unavailable', "\"{$method->label}\" is not available for {$currency}.", 422, [
                'paymentMethodId' => $method->rid,
                'currency' => strtoupper($currency),
            ]));
        }

        return ['method' => $method, 'provider' => $method->provider];
    }
}
