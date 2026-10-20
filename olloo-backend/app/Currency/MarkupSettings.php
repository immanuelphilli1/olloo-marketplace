<?php

declare(strict_types=1);

namespace App\Currency;

use App\Models\AppSetting;

/**
 * The store-wide markup on exchange rates. Staff set it on the admin
 * Currencies page; until then config('currency.default_markup_percent').
 */
final class MarkupSettings
{
    public const KEY = 'currency.default_markup_percent';

    public function defaultPercent(): float
    {
        $stored = AppSetting::query()->where('key', self::KEY)->value('value');

        return is_numeric($stored) ? (float) $stored : (float) config('currency.default_markup_percent');
    }

    public function isStored(): bool
    {
        return AppSetting::query()->where('key', self::KEY)->exists();
    }

    public function saveDefaultPercent(float $percent): void
    {
        AppSetting::query()->updateOrCreate(['key' => self::KEY], ['value' => (string) $percent]);
    }
}
