<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->string('name');
            $table->string('display_name')->nullable();
            // Soft-deleted accounts keep their orders, so email uniqueness has to
            // ignore them: `active_email` is the same value while the row is
            // live and NULL once it is deleted, which frees the address for
            // re-registration while the old row still holds its email.
            $table->string('email')->index();
            $table->string('active_email')->nullable()->virtualAs('case when deleted_at is null then email end');
            $table->unique('active_email');
            $table->string('phone')->nullable();
            $table->string('avatar_path')->nullable();
            $table->string('user_type', 20)->default('customer'); // customer|staff
            $table->boolean('is_guest')->default(false);
            $table->boolean('two_factor_enabled')->default(false);
            // Encrypted at rest with APP_KEY.
            $table->text('two_factor_secret')->nullable();
            $table->boolean('must_change_password')->default(false);
            $table->boolean('notify_promotions')->default(true);
            $table->boolean('notify_order_updates')->default(true);
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password')->nullable();
            $table->string('oauth_provider')->nullable();
            $table->string('oauth_provider_id')->nullable();
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });

        Schema::create('refresh_tokens', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('token_hash', 64)->unique();
            $table->timestamp('expires_at');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refresh_tokens');
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};
