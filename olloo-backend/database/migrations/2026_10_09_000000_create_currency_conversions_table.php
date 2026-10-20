<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mid-market rate per ordered currency pair, refreshed by
 * `currency:update-rates`. `markup_percent` is the staff override for the
 * pair; NULL means the store default markup applies.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('currency_conversions', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->string('from_currency_code', 3);
            $table->string('to_currency_code', 3);
            $table->decimal('rate', 24, 12);
            $table->decimal('markup_percent', 6, 3)->nullable();
            $table->timestamp('fetched_at');
            $table->string('source', 40);
            $table->timestamps();

            $table->unique(['from_currency_code', 'to_currency_code']);
            $table->foreign('from_currency_code')->references('code')->on('currencies')->cascadeOnDelete()->cascadeOnUpdate();
            $table->foreign('to_currency_code')->references('code')->on('currencies')->cascadeOnDelete()->cascadeOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('currency_conversions');
    }
};
