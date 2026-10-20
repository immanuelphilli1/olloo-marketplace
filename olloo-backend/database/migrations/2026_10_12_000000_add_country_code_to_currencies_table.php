<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The currency's own country: USD belongs to the US, GHS to Ghana.
 *
 * `countries.currency_code` already answers the other direction, "what currency
 * does a shopper here pay in", and it is many-to-one: 18 countries carry USD, so
 * it cannot be inverted. That is why unplaceable shoppers previously fell
 * through to "first country whose currency matches the default", which on a
 * synced database resolves to American Samoa. This column is the explicit
 * inverse, one country per currency, so the default currency can name the
 * market it belongs to.
 *
 * Kept nullable and without a foreign key. A gateway may onboard a currency
 * before `countries:sync` has the row (or before this column is backfilled on an
 * existing install), and a currency that cannot be placed must not stop being
 * sellable. Read back by `ShopperLocale::defaultCountry()`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('currencies', function (Blueprint $table): void {
            $table->string('country_code', 2)->nullable()->after('code');
        });

        // Backfill from the seed data this repo ships, matched on code so it is
        // safe on any install. Written as raw SQL over the join rather than the
        // model: migrations must not depend on application code, and the model
        // is about to gain a field it does not have yet.
        foreach (['USD' => 'US', 'AED' => 'AE', 'GHS' => 'GH'] as $currency => $country) {
            DB::table('currencies')
                ->where('code', $currency)
                ->whereNull('country_code')
                ->update(['country_code' => $country]);
        }
    }

    public function down(): void
    {
        Schema::table('currencies', function (Blueprint $table): void {
            $table->dropColumn('country_code');
        });
    }
};
