<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One bulk product import run.
 *
 * The CSV and photo work happens on the queue, so the staff member who
 * pressed Import needs somewhere to see that it ran, what it changed and what
 * it could not do. This row is that record, and it is the only durable link
 * between the button press and the outcome: the parsed plan itself is not
 * kept, only the report.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_imports', function (Blueprint $table) {
            $table->id();
            $table->string('rid', 12)->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            // csv or images: which of the two bulk screens started this.
            $table->string('kind', 20);
            $table->string('filename');
            // queued, running, done or failed. Never guessed from a counter:
            // a run that dies mid-way must read as failed, not as zero done.
            $table->string('status', 20)->default('queued');
            $table->unsignedInteger('created_count')->default(0);
            $table->unsignedInteger('updated_count')->default(0);
            $table->unsignedInteger('skipped_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            // Per-row outcome for the staff member to read, capped in the job.
            $table->json('report')->nullable();
            $table->text('error')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_imports');
    }
};
