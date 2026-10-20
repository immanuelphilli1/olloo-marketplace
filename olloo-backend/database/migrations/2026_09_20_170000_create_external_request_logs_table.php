<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('external_request_logs', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 32)->unique();
            $table->string('direction', 16)->index();
            $table->string('service', 64)->index();
            $table->string('action', 64)->nullable()->index();
            $table->string('request_method', 16)->nullable();
            $table->text('request_url')->nullable();
            $table->unsignedSmallInteger('status_code')->nullable()->index();
            $table->boolean('success')->default(false)->index();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->longText('request_headers')->nullable();
            $table->longText('request_body')->nullable();
            $table->longText('response_headers')->nullable();
            $table->longText('response_body')->nullable();
            $table->string('exception_class')->nullable();
            $table->text('exception_message')->nullable();
            $table->foreignId('user_id')->nullable()->index()->constrained('users');
            $table->string('guard', 32)->nullable()->index();
            $table->json('meta')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('external_request_logs');
    }
};
