<?php

declare(strict_types=1);

namespace App\Payments;

use App\Models\Currency;
use InvalidArgumentException;

final class CurrencyGatewayResolver
{
    /**
     * Resolve the payment provider for a currency code.
     * Uses the currency row's payment_provider; never invents a default.
     */
    public function forCurrency(string $currencyCode, ?string $overrideProvider = null): string
    {
        if (is_string($overrideProvider) && $overrideProvider !== '') {
            return $overrideProvider;
        }

        $code = strtoupper(trim($currencyCode));
        if ($code === '') {
            throw new InvalidArgumentException('Currency code is required to resolve a payment provider.');
        }

        $currency = Currency::query()->where('code', $code)->first();

        if (! $currency instanceof Currency) {
            throw new InvalidArgumentException("Currency [{$code}] is not configured.");
        }

        $provider = $currency->payment_provider;

        if (! is_string($provider) || trim($provider) === '') {
            throw new InvalidArgumentException(
                "Currency [{$code}] is missing payment_provider. Set stripe or paystack explicitly."
            );
        }

        return trim($provider);
    }
}
