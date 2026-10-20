<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_logs', function (Blueprint $table): void {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->string('status', 32)->index();
            $table->string('mailer', 64)->nullable()->index();
            $table->string('transport', 64)->nullable();
            $table->string('mailable_class')->nullable()->index();
            $table->string('notification_class')->nullable()->index();
            $table->string('subject')->nullable()->index();
            $table->string('message_id')->nullable()->index();
            $table->json('from_addresses')->nullable();
            $table->json('to_addresses')->nullable();
            $table->json('cc_addresses')->nullable();
            $table->json('bcc_addresses')->nullable();
            $table->json('reply_to_addresses')->nullable();
            $table->longText('html_body')->nullable();
            $table->longText('text_body')->nullable();
            $table->json('headers')->nullable();
            $table->json('attachments')->nullable();
            $table->unsignedInteger('size_bytes')->nullable();
            $table->string('locale', 16)->nullable();
            $table->string('queue')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('guard', 32)->nullable();
            $table->string('entity_type')->nullable()->index();
            $table->string('entity_rid', 64)->nullable()->index();
            $table->string('exception_class')->nullable();
            $table->text('exception_message')->nullable();
            $table->json('meta')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->timestamp('queued_at')->nullable()->index();
            $table->timestamp('sending_at')->nullable();
            $table->timestamp('sent_at')->nullable()->index();
            $table->timestamp('failed_at')->nullable()->index();
            $table->timestamp('read_at')->nullable()->index();
            $table->timestamp('last_opened_at')->nullable();
            $table->unsignedInteger('open_count')->default(0);
            $table->json('open_history')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['mailer', 'created_at']);
            $table->index(['read_at', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_logs');
    }
};
