<?php

declare(strict_types=1);

namespace Tests\Concerns;

use App\Models\Currency;

/** Currency rows that currency_code columns reference (USD default, plus AED and GHS). */
trait SeedsCurrencies
{
    protected function seedCurrencies(): void
    {
        // updateOrCreate, not firstOrCreate: the base-currency migration already
        // inserted USD with the production provider, and firstOrCreate would
        // leave it there so a test gateway would never be the one selected.
        foreach ([['USD', true], ['AED', false], ['GHS', false]] as [$code, $default]) {
            Currency::query()->updateOrCreate(
                ['code' => $code],
                ['name' => $code, 'payment_provider' => 'fake', 'is_default' => $default],
            );
        }
    }
}
