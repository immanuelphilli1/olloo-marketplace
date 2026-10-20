<?php

declare(strict_types=1);

namespace App\Payments;

use App\Payments\Contracts\PaymentGateway;
use InvalidArgumentException;

/**
 * Resolves a configured gateway by key.
 *
 * The key is always required: it comes from the currency row
 * (`CurrencyGatewayResolver::forCurrency`) or the chosen payment method. There
 * is deliberately no fallback, because a guessed provider silently sends a
 * currency to a gateway that cannot carry it.
 */
final class PaymentGatewayManager
{
    public function gateway(string $key): PaymentGateway
    {
        if (trim($key) === '') {
            throw new InvalidArgumentException('Payment provider key is required.');
        }

        $config = config("payments.providers.{$key}");

        if (! is_array($config) || ! isset($config['driver']) || ! is_string($config['driver']) || $config['driver'] === '') {
            throw new InvalidArgumentException("Payment provider [{$key}] is not configured.");
        }

        $driver = app($config['driver']);

        if (! $driver instanceof PaymentGateway) {
            throw new InvalidArgumentException("Payment provider [{$key}] driver must implement PaymentGateway.");
        }

        return $driver;
    }
}
