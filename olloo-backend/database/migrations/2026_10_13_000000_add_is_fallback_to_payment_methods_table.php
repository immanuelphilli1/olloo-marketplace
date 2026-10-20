<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Marks a method as the last resort rather than a market's first choice.
 *
 * Every seeded row is scoped to one market (AED rows to AE, GHS rows to GH), so a
 * shopper whose cart currency has no market of its own was offered nothing at all
 * and checkout dead-ended on an empty list. `is_fallback` says "this row belongs
 * to the default currency, takes any market, and stands in only when nothing
 * scoped matches".
 *
 * An explicit column rather than inference from an empty `countries` list: that
 * list was already carrying "this method takes any market", and the store default
 * currency can move (CurrencySeeder writes `is_default`), so deriving the fallback
 * set from it would silently change which methods a deploy offers.
 *
 * Backfilled by code rather than left false, since on an existing install the USD
 * rows are exactly the ones that need to stand in. PaymentMethodSeeder re-asserts
 * the flag per row on every deploy anyway, so this only decides the state between
 * the migration and the next seed.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('payment_methods', 'is_fallback')) {
            return;
        }

        Schema::table('payment_methods', function (Blueprint $table): void {
            $table->boolean('is_fallback')->default(false)->after('is_active');
        });

        // The store default currency's rows, so this follows the default if it has
        // already moved. Decoded in PHP rather than with whereJsonContains: the
        // column is json on MySQL and text on sqlite, and the two do not agree on
        // how a JSON array is matched. The model is deliberately not used here,
        // as a migration must not depend on application code.
        $default = DB::table('currencies')
            ->where('is_default', true)
            ->value('code');

        if (! is_string($default) || $default === '') {
            return;
        }

        $fallbackRids = DB::table('payment_methods')
            ->pluck('currencies', 'rid')
            ->filter(function (mixed $currencies) use ($default): bool {
                $decoded = is_string($currencies) ? json_decode($currencies, true) : $currencies;

                return is_array($decoded)
                    && in_array(strtoupper($default), array_map('strtoupper', array_map('strval', $decoded)), true);
            })
            ->keys();

        DB::table('payment_methods')
            ->whereIn('rid', $fallbackRids)
            ->update(['is_fallback' => true]);
    }

    public function down(): void
    {
        if (! Schema::hasColumn('payment_methods', 'is_fallback')) {
            return;
        }

        Schema::table('payment_methods', function (Blueprint $table): void {
            $table->dropColumn('is_fallback');
        });
    }
};
