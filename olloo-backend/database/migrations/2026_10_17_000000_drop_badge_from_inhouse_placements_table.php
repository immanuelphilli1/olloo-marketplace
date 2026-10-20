<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The storefront no longer shows a badge pill on banners, so staff no longer
 * set one. Guarded so a re-run after a partial deploy is a no-op.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('inhouse_placements', 'badge')) {
            Schema::table('inhouse_placements', function (Blueprint $table): void {
                $table->dropColumn('badge');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('inhouse_placements', 'badge')) {
            Schema::table('inhouse_placements', function (Blueprint $table): void {
                $table->string('badge', 40)->nullable()->after('alt_text');
            });
        }
    }
};
