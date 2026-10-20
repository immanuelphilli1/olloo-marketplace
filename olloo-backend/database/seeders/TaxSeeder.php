<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\TaxClass;
use App\Models\TaxRate;
use Illuminate\Database\Seeder;

/**
 * Prices are tax-exclusive; tax is added for the destination country.
 * Only countries with rates are taxed (the store collects where it is
 * registered): the UAE (5% VAT) and Ghana (levies plus VAT, with VAT
 * charged on the levies-inclusive base, as Ghana does).
 */
class TaxSeeder extends Seeder
{
    public function run(): void
    {
        TaxClass::query()->updateOrCreate(
            ['name' => 'Zero-rated'],
            [],
        );

        $rates = [
            [
                'name' => 'UAE VAT',
                'country' => 'AE',
                'tax_class_id' => null,
                'rate_bp' => 500,
                'is_compound' => false,
                'applies_to_shipping' => true,
                'sort_order' => 0,
                'is_active' => true,
            ],
            [
                'name' => 'NHIL',
                'country' => 'GH',
                'tax_class_id' => null,
                'rate_bp' => 250,
                'is_compound' => false,
                'applies_to_shipping' => true,
                'sort_order' => 0,
                'is_active' => true,
            ],
            [
                'name' => 'GETFund Levy',
                'country' => 'GH',
                'tax_class_id' => null,
                'rate_bp' => 250,
                'is_compound' => false,
                'applies_to_shipping' => true,
                'sort_order' => 1,
                'is_active' => true,
            ],
            [
                'name' => 'Ghana VAT',
                'country' => 'GH',
                'tax_class_id' => null,
                'rate_bp' => 1500,
                'is_compound' => true,
                'applies_to_shipping' => true,
                'sort_order' => 2,
                'is_active' => true,
            ],
        ];

        foreach ($rates as $rate) {
            TaxRate::query()->updateOrCreate(
                ['country' => $rate['country'], 'name' => $rate['name']],
                $rate,
            );
        }
    }
}
