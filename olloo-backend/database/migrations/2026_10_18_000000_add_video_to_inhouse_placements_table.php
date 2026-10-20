<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Video slots (the storefront's top video strip) store the video here; `image`
 * stays the poster shown before it plays or when the browser blocks autoplay.
 * Guarded so a re-run after a partial deploy is a no-op.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('inhouse_placements', 'video')) {
            Schema::table('inhouse_placements', function (Blueprint $table): void {
                $table->string('video', 500)->nullable()->after('image');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('inhouse_placements', 'video')) {
            Schema::table('inhouse_placements', function (Blueprint $table): void {
                $table->dropColumn('video');
            });
        }
    }
};
