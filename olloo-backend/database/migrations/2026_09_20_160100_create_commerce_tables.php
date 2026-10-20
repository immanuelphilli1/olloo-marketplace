<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Payments reference this, so it is created before the payment table. Routing
        // is by method plus currency: each method names its provider and the
        // currencies (and optionally countries) it serves, so a method is never
        // offered where its gateway is not set up for that currency.
        Schema::create('payment_methods', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->string('code', 60)->unique();
            $table->string('label', 120);
            $table->string('provider', 60);
            // A seeded artwork key or a staff-uploaded image path.
            $table->string('icon', 2048)->nullable();
            $table->json('currencies')->nullable();
            $table->json('countries')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('carts', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            // No default: a cart must say which currency it is priced in.
            $table->string('currency_code', 3);
            $table->foreign('currency_code')->references('code')->on('currencies')->restrictOnDelete()->cascadeOnUpdate();
            $table->timestamps();
        });

        Schema::create('cart_items', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->foreignId('cart_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            // The variant is the sellable unit, so every cart line names one.
            $table->foreignId('product_variant_id')->constrained('product_variants')->cascadeOnDelete();
            $table->unsignedInteger('quantity')->default(1);
            $table->boolean('selected')->default(true);
            $table->unsignedInteger('unit_price_minor');
            $table->timestamps();

            // Per variant, not per product: one line per variant of a product.
            $table->unique(['cart_id', 'product_variant_id']);
        });

        Schema::create('wishlists', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'product_id']);
        });

        Schema::create('addresses', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Addresses belong to a country row: tax and delivery both key off it.
            $table->foreignId('country_id')->constrained('countries')->restrictOnDelete();
            // Region and city link to the geo tables when they match. The text
            // below stays as the display value, so a customer can still type a
            // place the lookup lists do not have.
            $table->foreignId('region_id')->nullable()->constrained('regions')->nullOnDelete();
            $table->foreignId('city_id')->nullable()->constrained('cities')->nullOnDelete();
            $table->string('first_name');
            $table->string('last_name');
            $table->string('phone_country_code');
            $table->string('phone_number');
            $table->string('address_line');
            $table->string('region');
            $table->string('city');
            $table->string('city_line')->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->string('order_reference')->unique();
            // Orders and the catalogue are never deleted out from under a
            // customer: restrict, do not cascade.
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('address_id')->nullable()->constrained()->nullOnDelete();
            // No default on status or the money columns: an order is always
            // written with an explicit lifecycle state and frozen totals.
            $table->string('status', 30);
            // Fulfilment and payment are separate axes: an order can be
            // delivered and still unpaid, or paid and not yet shipped.
            $table->string('payment_status', 20);
            $table->string('payment_method', 40)->nullable();
            // The currency the shopper was charged in, and the base its total
            // is also valued in for reporting.
            $table->string('currency_code', 3);
            $table->foreign('currency_code')->references('code')->on('currencies')->restrictOnDelete()->cascadeOnUpdate();
            $table->string('base_currency_code', 3)->nullable();
            $table->bigInteger('items_total_minor');
            $table->bigInteger('items_discount_minor');
            $table->bigInteger('shipping_minor');
            $table->bigInteger('tax_minor')->default(0);
            $table->bigInteger('total_minor');
            $table->unsignedBigInteger('base_total_minor')->nullable();
            $table->string('estimated_delivery')->nullable();
            $table->json('shipping_snapshot')->nullable();
            // The rate, markup and per-line source price this order was placed
            // at, so a price can be explained long after the rate has moved.
            $table->json('fx_snapshot')->nullable();
            $table->json('address_snapshot')->nullable();
            $table->timestamp('placed_at')->nullable();
            // Status dates and return windows run from the real dates, not from
            // a guess made at read time.
            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index(['status', 'payment_status']);
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->string('product_rid')->nullable();
            $table->string('product_name');
            $table->string('variant_name')->nullable();
            $table->string('sku', 64)->nullable();
            $table->string('image')->nullable();
            // The price charged, in the order's currency, plus the price this
            // line started from in the product's own currency.
            $table->unsignedInteger('unit_price_minor');
            $table->string('source_currency_code', 3)->nullable();
            $table->unsignedInteger('source_unit_price_minor')->nullable();
            $table->bigInteger('tax_minor')->default(0);
            $table->unsignedInteger('quantity');
            $table->timestamps();
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('payment_method_id')->nullable()->constrained()->nullOnDelete();
            $table->string('provider', 20);
            $table->string('status', 30)->default('pending');
            $table->bigInteger('amount_minor');
            $table->string('currency_code', 3);
            $table->foreign('currency_code')->references('code')->on('currencies')->restrictOnDelete()->cascadeOnUpdate();
            $table->string('external_reference')->nullable()->index();
            // Stripe's hosted Checkout URL embeds a long fragment and runs well
            // past 255 characters, so every gateway's URL has to fit the
            // longest of them.
            $table->string('checkout_url', 1024)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('payment_webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->string('provider', 20);
            $table->string('external_event_id');
            $table->string('event_type')->nullable();
            $table->json('payload');
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->unique(['provider', 'external_event_id']);
        });

        Schema::create('saved_payment_methods', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 30);
            $table->string('cardholder_name');
            $table->string('masked_detail');
            $table->string('network')->nullable();
            // Encrypted at rest with APP_KEY, so text: a ciphertext is longer
            // than the 255 characters a string column allows.
            $table->text('provider_token')->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        Schema::create('order_returns', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('status', 30)->default('requested');
            $table->text('reason')->nullable();
            $table->timestamps();
        });

        Schema::create('order_tracking_events', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('label');
            $table->string('description')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_tracking_events');
        Schema::dropIfExists('order_returns');
        Schema::dropIfExists('saved_payment_methods');
        Schema::dropIfExists('payment_webhook_events');
        Schema::dropIfExists('payments');
        // payments referenced this, so it goes last.
        Schema::dropIfExists('payment_methods');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('addresses');
        Schema::dropIfExists('wishlists');
        Schema::dropIfExists('cart_items');
        Schema::dropIfExists('carts');
    }
};
