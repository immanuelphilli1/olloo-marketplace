<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Product families: separately uploaded products that are the same model in
 * different sizes or capacities (a TV in 32" and 43"). Products sharing a
 * `family_key` are offered as options of each other on the product page,
 * labelled by `family_option_name` ("Size") and `family_option_value` ("43 inch").
 *
 * Every column is nullable, so a product with no family behaves exactly as
 * before. Each step guards itself so a half-applied run can be re-run.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('products', 'family_key')) {
            Schema::table('products', function (Blueprint $table) {
                $table->string('family_key', 120)->nullable()->after('category_id');
            });
        }

        if (! Schema::hasColumn('products', 'family_option_name')) {
            Schema::table('products', function (Blueprint $table) {
                $table->string('family_option_name', 40)->nullable()->after('family_key');
            });
        }

        if (! Schema::hasColumn('products', 'family_option_value')) {
            Schema::table('products', function (Blueprint $table) {
                $table->string('family_option_value', 60)->nullable()->after('family_option_name');
            });
        }

        if (! Schema::hasIndex('products', 'products_family_key_index')) {
            Schema::table('products', function (Blueprint $table) {
                $table->index('family_key');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasIndex('products', 'products_family_key_index')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropIndex('products_family_key_index');
            });
        }

        foreach (['family_option_value', 'family_option_name', 'family_key'] as $column) {
            if (Schema::hasColumn('products', $column)) {
                Schema::table('products', function (Blueprint $table) use ($column) {
                    $table->dropColumn($column);
                });
            }
        }
    }
};
