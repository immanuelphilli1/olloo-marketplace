<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phone sign-in. `login_phone` is separate from the free-text profile `phone`
 * on purpose: that column has never been normalised, so existing rows may share
 * a number written two ways, and a unique index on it could fail on deploy.
 * `login_phone` only ever holds `GhanaPhone::normalize()` output.
 *
 * Uniqueness ignores soft-deleted accounts the same way `active_email` does, so
 * a deleted account frees its number for a new registration.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'login_phone')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('login_phone', 20)->nullable()->after('phone');
            });
        }

        if (! Schema::hasColumn('users', 'active_login_phone')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('active_login_phone', 20)->nullable()
                    ->virtualAs('case when deleted_at is null then login_phone end');
            });
        }

        if (! Schema::hasIndex('users', 'users_active_login_phone_unique')) {
            Schema::table('users', function (Blueprint $table) {
                $table->unique('active_login_phone');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasIndex('users', 'users_active_login_phone_unique')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropUnique('users_active_login_phone_unique');
            });
        }

        if (Schema::hasColumn('users', 'active_login_phone')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('active_login_phone');
            });
        }

        if (Schema::hasColumn('users', 'login_phone')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('login_phone');
            });
        }
    }
};
