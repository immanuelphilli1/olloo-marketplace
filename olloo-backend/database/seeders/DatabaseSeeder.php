<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * Model events stay enabled so HasRid can auto-generate rid values.
     */
    public function run(): void
    {
        $this->call([
            AdminPermissionsSeeder::class,
            CurrencySeeder::class,
            CategorySeeder::class,
            ProductSeeder::class,
            GeoSeeder::class,
            ShippingRuleSeeder::class,
            TaxSeeder::class,
            PaymentMethodSeeder::class,
            ContentSeeder::class,
            UserSeeder::class,
            SampleOrderSeeder::class,
        ]);
    }
}
