<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The store's base currency becomes USD: it is what the catalogue is priced in
 * and what every market we do not sell in locally falls back to.
 *
 * USD is inserted first because products, carts, orders, payments, shipping
 * rules and rate pairs all carry a foreign key onto `currencies.code`, so the
 * row has to exist before anything can be repointed at it. The rid is filled
 * here because `currencies.rid` is NOT NULL and HasRid only fills it through
 * the model's creating event, which a query-builder insert bypasses.
 *
 * Product amounts are NOT converted. `price_minor` keeps its number and only
 * the currency it is denominated in changes. That is a relabel, not a
 * revaluation, and it is only correct because the catalogue is seed data whose
 * numbers never stood for real money in any currency. If this ever runs against
 * a live catalogue, convert at a stored rate instead: reading "179.00" as
 * dollars rather than dirhams silently triples every price.
 *
 * Past orders keep the base currency they were valued in. An order placed while
 * AED was the base carries `base_currency_code = AED`, and rewriting that to
 * USD would make historical reporting claim a conversion that never happened.
 */
return new class extends Migration
{
    private const BASE = 'USD';

    private const PREVIOUS_BASE = 'AED';

    public function up(): void
    {
        $this->ensureBaseCurrencyExists();

        // Exactly one default, or Currency::defaultCode() is ambiguous.
        DB::table('currencies')->where('code', '!=', self::BASE)->update(['is_default' => false]);
        DB::table('currencies')->where('code', self::BASE)->update(['is_default' => true]);

        DB::table('products')
            ->where('currency_code', '!=', self::BASE)
            ->update(['currency_code' => self::BASE]);
    }

    public function down(): void
    {
        DB::table('currencies')
            ->where('code', '=', self::PREVIOUS_BASE)
            ->update(['is_default' => true]);
        DB::table('currencies')
            ->where('code', '!=', self::PREVIOUS_BASE)
            ->update(['is_default' => false]);
    }

    private function ensureBaseCurrencyExists(): void
    {
        $exists = DB::table('currencies')->where('code', self::BASE)->exists();
        if ($exists) {
            return;
        }

        DB::table('currencies')->insert([
            'rid' => generate_rid(),
            'code' => self::BASE,
            'name' => 'US Dollar',
            // Stripe carries USD as well as AED; Paystack cannot.
            'payment_provider' => 'stripe',
            'decimal_places' => 2,
            'is_default' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
};
