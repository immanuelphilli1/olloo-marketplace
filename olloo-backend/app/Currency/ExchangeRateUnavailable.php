<?php

declare(strict_types=1);

namespace App\Currency;

use RuntimeException;

/** No rate for the pair, or the stored one is older than currency.max_rate_age_hours. */
final class ExchangeRateUnavailable extends RuntimeException
{
    public static function for(string $from, string $to, string $why): self
    {
        return new self("No usable {$from} to {$to} exchange rate: {$why}. Run `php artisan currency:update-rates`.");
    }
}
