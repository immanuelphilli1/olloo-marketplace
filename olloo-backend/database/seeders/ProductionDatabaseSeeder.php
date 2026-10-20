<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Idempotent catalogs that every production deploy runs.
 *
 * Two rules decide membership.
 *
 * 1. Safe to re-run against a live database. Anything that overwrites a value
 *    staff tuned is out, because a deploy would silently revert their work.
 * 2. Needed for the app to function, or is a deployment concern rather than
 *    editorial content.
 *
 * Included:
 * - AdminPermissionsSeeder: a permission added in a release has to exist before
 *   the staff UI offers it, and roles re-sync to the full list.
 * - CurrencySeeder: which currencies exist and the market each belongs to. Only
 *   new rows are written in full; `payment_provider` and `is_default` belong to
 *   staff (the admin Currencies page edits both) so a deploy never touches them.
 * - GeoSeeder: the countries those currencies belong to. Without them a shopper
 *   we cannot place has no country at all, which turns delivery claims and tax
 *   off. A static baseline, not a RestCountries refresh (that is admin Sync or
 *   `php artisan countries:sync`, and it never deletes rows).
 * - PaymentMethodSeeder: one row per (currency, country) market. Re-asserts
 *   routing and preserves staff edits to label, icon, order and active state.
 *
 * Excluded, and why:
 * - ShippingRuleSeeder and TaxSeeder re-apply fee and rate payloads on every
 *   run, so a deploy would reset fees and tax rates staff have tuned.
 * - CategorySeeder re-activates categories (`is_active` is in the payload), so
 *   a retired category comes back on every deploy.
 * - ContentSeeder, ProductSeeder, SampleOrderSeeder: editorial and demo data.
 * - UserSeeder: demo logins with a known password. Never in production.
 *
 * Do not run `php artisan db:seed` in production. That is DatabaseSeeder and it
 * includes the demo catalogue, demo orders and demo accounts.
 *
 *   php artisan db:seed --class=ProductionDatabaseSeeder --force
 *
 * Run it after `migrate`, every release. It is safe to run twice.
 */
class ProductionDatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            AdminPermissionsSeeder::class,
            CurrencySeeder::class,
            GeoSeeder::class,
            PaymentMethodSeeder::class,
        ]);
    }
}
