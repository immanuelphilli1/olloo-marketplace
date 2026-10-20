<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reviews', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            // One review per order line, and only an approved one is shown.
            $table->foreignId('order_item_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->string('title')->nullable();
            $table->text('body')->nullable();
            $table->string('author_display')->nullable();
            $table->string('location')->nullable();
            $table->boolean('is_approved')->default(false);
            $table->timestamps();

            $table->unique('order_item_id');
        });

        Schema::create('browsing_history', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('guest_token', 64)->nullable()->index();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->timestamp('viewed_at');
            $table->timestamps();
        });

        Schema::create('content_pages', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->string('slug')->unique();
            $table->string('title');
            $table->string('last_updated')->nullable();
            $table->json('intro')->nullable();
            $table->json('blocks')->nullable();
            $table->timestamps();
        });

        Schema::create('content_blocks', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->string('key')->unique(); // home, footer
            $table->json('payload');
            $table->timestamps();
        });

        Schema::create('newsletter_subscribers', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->string('email')->unique();
            $table->string('unsubscribe_token', 64)->unique();
            $table->timestamp('subscribed_at');
            $table->timestamp('unsubscribed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('inquiries', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->string('type', 40); // partnership|quotation|agent
            $table->string('email')->nullable();
            $table->string('name')->nullable();
            $table->json('payload')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inquiries');
        Schema::dropIfExists('newsletter_subscribers');
        Schema::dropIfExists('content_blocks');
        Schema::dropIfExists('content_pages');
        Schema::dropIfExists('browsing_history');
        Schema::dropIfExists('reviews');
    }
};
