<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-user key/value settings, so a shopper's own choices survive the request
 * they made them in.
 *
 * Only two are set by the application today, and both feed currency
 * determination:
 * - assigned_country: where we placed this shopper (detected from their IP the
 *   first time we saw them, or set by staff).
 * - preferred_country: what the shopper chose for themselves, which wins over
 *   the assigned one.
 *
 * A key/value table rather than columns on users, so a new preference does not
 * need a migration. No rid: this is a private per-user table that is never a
 * resource on its own, the same as app_settings.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_settings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('config_name', 60);
            $table->string('config_display_name')->nullable();
            $table->text('config_value')->nullable();
            $table->string('config_type', 20)->default('input');
            $table->json('config_options')->nullable();
            $table->string('config_hint')->nullable();
            $table->timestamps();

            // One value per setting per user: the row is updated, not appended.
            $table->unique(['user_id', 'config_name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_settings');
    }
};
