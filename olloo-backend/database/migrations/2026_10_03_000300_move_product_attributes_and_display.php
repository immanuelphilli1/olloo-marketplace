<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Facet attributes (brand, color, screen size, delivery) live in
 * product_attributes rather than fixed product columns, so a new filter needs no
 * migration.
 *
 * Attributes are *defined* per category and inherited by subcategories, in
 * category_attributes, which is created first because product_attributes points
 * at it. products only set values for attributes their category lineage offers.
 *
 * Storefront presentation hints live in one `display` JSON column on products.
 *
 * Per-product shipping is gone: shipping rules are the one source. products
 * keeps no shipping_fee_minor, delivery_estimate, tag, brand, color,
 * screen_size, delivery, image_object_position, show_add_button or price_orange
 * column.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('category_attributes', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            // Stable filter key used on the wire (?brand=, facets.attributes.brand).
            $table->string('key', 60);
            $table->string('label', 120);
            // Allowed values; NULL means free text.
            $table->json('options')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['category_id', 'key']);
        });

        Schema::create('product_attributes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            // The definition this value satisfies; NULL means the attribute has
            // no definition on this product's category (for example `delivery`,
            // which stays a product-level field).
            $table->foreignId('category_attribute_id')->nullable()->constrained('category_attributes')->cascadeOnDelete();
            $table->string('name', 60);
            $table->string('value');
            $table->timestamps();

            $table->unique(['product_id', 'name']);
            $table->index(['name', 'value']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_attributes');
        Schema::dropIfExists('category_attributes');
    }
};
