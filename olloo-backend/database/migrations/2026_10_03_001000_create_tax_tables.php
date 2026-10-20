<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tax on top of tax-exclusive prices, by destination country.
 *
 * - tax_rates: one row per tax component a country charges (for example VAT,
 *   or VAT plus levies). Only countries with rates are taxed: the store
 *   collects where it is registered. A compound rate is charged on the line plus
 *   the non-compound taxes before it.
 * - tax_classes: products outside the standard rate (for example zero-rated). A
 *   rate applies to products of its class (NULL = standard).
 * - Orders keep the tax they charged per component (order_tax_lines) and per
 *   item, and their total includes tax.
 */
return new class extends Migration
{
    public function up(): void
    {
        // tax_classes is created in 2026_09_20_160000 because products reference
        // it and that table comes first.
        Schema::create('tax_rates', function (Blueprint $table): void {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->string('name', 80);
            $table->char('country', 2);
            // NULL = standard-rated products.
            $table->foreignId('tax_class_id')->nullable()->constrained('tax_classes')->restrictOnDelete();
            // Basis points: 500 = 5.00%.
            $table->unsignedInteger('rate_bp');
            $table->boolean('is_compound');
            $table->boolean('applies_to_shipping');
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['country', 'is_active', 'sort_order']);
        });

        Schema::create('order_tax_lines', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->char('country', 2);
            $table->unsignedInteger('rate_bp');
            $table->boolean('is_compound');
            $table->bigInteger('taxable_minor');
            $table->bigInteger('amount_minor');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_tax_lines');
        Schema::dropIfExists('tax_rates');
    }
};
