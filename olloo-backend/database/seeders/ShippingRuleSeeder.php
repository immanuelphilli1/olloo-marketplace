<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Currency;
use App\Models\ShippingClass;
use App\Models\ShippingRule;
use App\Services\DeliveryQuoteCache;
use Illuminate\Database\Seeder;

class ShippingRuleSeeder extends Seeder
{
    /**
     * Seed the default flat rule from the legacy env fee so deploy behavior
     * is unchanged. Staff refine rules in the portal afterwards.
     */
    public function run(): void
    {
        $currency = Currency::defaultCode();

        ShippingRule::query()->updateOrCreate(
            ['name' => 'Default flat rate'],
            [
                'strategy' => ShippingRule::STRATEGY_FLAT,
                'fee_minor' => (int) config('shipping.fee_minor', 2000),
                'currency_code' => $currency,
                'country' => null,
                'min_subtotal_minor' => null,
                'priority' => 100,
                'is_active' => true,
                'transit_days_min' => 2,
                'transit_days_max' => 4,
            ],
        );

        ShippingRule::query()->updateOrCreate(
            ['name' => 'Free over '.$currency.' 500'],
            [
                'strategy' => ShippingRule::STRATEGY_FREE_OVER_THRESHOLD,
                'fee_minor' => 0,
                'currency_code' => $currency,
                'country' => null,
                'min_subtotal_minor' => 50000,
                'priority' => 50,
                'is_active' => true,
                'transit_days_min' => 2,
                'transit_days_max' => 4,
            ],
        );

        $bulky = ShippingClass::query()->firstOrCreate(['name' => 'Bulky']);
        ShippingRule::query()->updateOrCreate(
            ['name' => 'Bulky items'],
            [
                'strategy' => ShippingRule::STRATEGY_FLAT,
                'fee_minor' => 15000,
                'currency_code' => $currency,
                'country' => null,
                'shipping_class_id' => $bulky->id,
                'min_subtotal_minor' => null,
                'priority' => 100,
                'is_active' => true,
                'transit_days_min' => 5,
                'transit_days_max' => 10,
            ],
        );

        // Rules changed after products were seeded: rebuild delivery now
        // rather than waiting for the queue.
        app(DeliveryQuoteCache::class)->refreshAll();
    }
}
