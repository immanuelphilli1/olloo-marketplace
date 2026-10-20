<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('external_request_log_entities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('external_request_log_id')
                ->constrained('external_request_logs')
                ->cascadeOnDelete();
            $table->string('entity_type');
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->string('entity_rid', 32)->nullable();
            $table->timestamps();

            $table->index(['entity_type', 'entity_id']);
            $table->index(['entity_type', 'entity_rid']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('external_request_log_entities');
    }
};
