<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Banners staff place on storefront pages. A slot is a page plus a position
 * (home + hero is the top carousel); the allowed slots live in
 * InhousePlacement::SLOTS, not in the database, because each one needs a
 * storefront component that renders it.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('inhouse_placements')) {
            return;
        }

        Schema::create('inhouse_placements', function (Blueprint $table): void {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->string('page', 40);
            $table->string('position', 40);
            $table->string('image', 500);
            $table->string('alt_text', 160)->nullable();
            $table->string('badge', 40)->nullable();
            $table->string('title', 120)->nullable();
            $table->string('description', 500)->nullable();
            $table->string('button_text', 40)->nullable();
            $table->string('link_url', 500)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['page', 'position', 'is_active', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inhouse_placements');
    }
};
