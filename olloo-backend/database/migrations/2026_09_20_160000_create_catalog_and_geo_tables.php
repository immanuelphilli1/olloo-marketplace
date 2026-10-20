<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('currencies', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->string('code', 3)->unique();
            $table->string('name');
            $table->string('payment_provider', 20); // stripe|paystack — required, no silent default
            $table->unsignedTinyInteger('decimal_places')->default(2);
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        // Products reference both, so they are created before the product table.
        // Shipping classes group products that ship differently (for example
        // bulky items) and rules can target a class; tax classes hold products
        // outside the standard rate (for example zero-rated). Their rules and
        // rates live in 2026_10_01_000000 and 2026_10_03_001000.
        Schema::create('shipping_classes', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->string('name', 80)->unique();
            $table->timestamps();
        });

        Schema::create('tax_classes', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->string('name', 80)->unique();
            $table->timestamps();
        });

        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->string('slug')->unique();
            $table->string('label');
            $table->string('image')->nullable();
            $table->foreignId('parent_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            // Return eligibility, inherited by subcategories. Orders enforce the
            // window from the real delivered date.
            $table->boolean('is_returnable')->default(true);
            $table->unsignedInteger('return_window_days')->nullable();
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->string('slug')->unique();
            // Products are never deleted out from under an order line: restrict.
            $table->foreignId('category_id')->constrained()->restrictOnDelete();
            $table->string('name');
            $table->string('image')->nullable();
            // Storefront presentation hints (imageObjectPosition, priceOrange).
            $table->json('display')->nullable();
            $table->unsignedInteger('price_minor');
            $table->unsignedInteger('original_price_minor')->nullable();
            // Prices stay stored in the product's own currency and are converted
            // at the edge, so no default: a product must say which currency it is.
            $table->string('currency_code', 3);
            $table->foreign('currency_code')->references('code')->on('currencies')->restrictOnDelete()->cascadeOnUpdate();
            // NULL = ships as standard; rules can target a class.
            $table->foreignId('shipping_class_id')->nullable()->constrained('shipping_classes')->restrictOnDelete();
            // NULL = standard-rated. A rate applies to products of its class.
            $table->foreignId('tax_class_id')->nullable()->constrained('tax_classes')->restrictOnDelete();
            $table->decimal('rating', 3, 2)->default(0);
            $table->unsignedInteger('review_count')->default(0);
            $table->unsignedInteger('sold_count')->default(0);
            $table->string('discount_notice')->nullable();
            $table->json('description_lines')->nullable();
            $table->boolean('is_featured')->default(false);
            $table->boolean('is_new_arrival')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['is_featured', 'is_active']);
            $table->index(['is_new_arrival', 'is_active']);
        });

        Schema::create('product_images', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            // Fashion options, chosen per variant rather than encoded in the name.
            $table->string('size', 60)->nullable();
            $table->string('color', 60)->nullable();
            $table->string('sku', 64);
            $table->unique('sku');
            $table->unsignedInteger('price_minor')->nullable();
            // NULL means stock is not tracked (made to order).
            $table->unsignedInteger('stock_quantity')->nullable();
            // Days before dispatch; NULL = store default
            // (config shipping.default_handling_days).
            $table->unsignedSmallInteger('handling_days')->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        Schema::create('countries', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->string('code', 2)->unique();
            $table->string('alpha3', 3)->nullable();
            $table->string('name');
            $table->string('region', 60)->nullable();
            $table->string('phone_code')->nullable();
            // What decides the currency a shopper in this country is charged in.
            $table->string('currency_code', 3)->nullable();
            $table->string('flag', 16)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();
        });

        Schema::create('regions', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->foreignId('country_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('cities', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->foreignId('region_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cities');
        Schema::dropIfExists('regions');
        Schema::dropIfExists('countries');
        Schema::dropIfExists('product_variants');
        Schema::dropIfExists('product_images');
        Schema::dropIfExists('products');
        Schema::dropIfExists('tax_classes');
        Schema::dropIfExists('shipping_classes');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('currencies');
    }
};
