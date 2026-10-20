<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Shipping is worked out from rules, never typed per product.
 *
 * - shipping_classes group products that ship differently (for example bulky
 *   items); a rule can target a class.
 * - shipping_rules.transit_days_min/max is the courier time for that rule.
 * - product_variants.handling_days is days before dispatch (NULL = store
 *   default, config shipping.default_handling_days).
 * - product_delivery_quotes holds the resulting fee and day range per product
 *   and destination country, so listings can show and filter delivery cheaply.
 *   Refreshed by model events and `php artisan delivery:refresh`.
 *
 * A rule is written in one currency. Quoting in another converts both the fee
 * and the free-shipping threshold at the shopper rate.
 *
 * shipping_classes is created in 2026_09_20_160000_create_catalog_and_geo_tables.php
 * because products reference it and that file comes first.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipping_rules', function (Blueprint $table): void {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->string('name', 120);
            $table->string('strategy', 40);
            $table->unsignedInteger('fee_minor');
            $table->string('currency_code', 3);
            $table->foreign('currency_code')->references('code')->on('currencies')->restrictOnDelete()->cascadeOnUpdate();
            $table->char('country', 2)->nullable();
            $table->unsignedInteger('min_subtotal_minor')->nullable();
            // NULL = applies to products of any class without a more specific rule.
            $table->foreignId('shipping_class_id')->nullable()->constrained('shipping_classes')->restrictOnDelete();
            // Courier time for this rule, in business days.
            $table->unsignedSmallInteger('transit_days_min');
            $table->unsignedSmallInteger('transit_days_max');
            $table->unsignedInteger('priority')->default(100);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['is_active', 'currency_code', 'country', 'priority', 'id']);
        });

        Schema::create('product_delivery_quotes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            // NULL = any destination without a country-specific rule.
            $table->char('country', 2)->nullable();
            $table->bigInteger('fee_minor');
            $table->boolean('is_free');
            $table->unsignedSmallInteger('days_min');
            $table->unsignedSmallInteger('days_max');
            $table->timestamps();

            $table->unique(['product_id', 'country']);
            $table->index(['country', 'is_free', 'days_max']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_delivery_quotes');
        Schema::dropIfExists('shipping_rules');
    }
};
