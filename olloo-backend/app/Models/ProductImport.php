<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One bulk import run, and the report the staff member reads afterwards.
 *
 * Import work happens on the queue, so this row is how a person finds out what
 * happened after they pressed Import. `status` is the source of truth for that
 * and is never derived: a run that dies part way reads as failed, not as a
 * partial success with a zero count.
 */
class ProductImport extends Model
{
    use HasRid;
    use Prunable;

    public const KIND_CSV = 'csv';

    public const KIND_IMAGES = 'images';

    public const QUEUED = 'queued';

    public const RUNNING = 'running';

    public const DONE = 'done';

    public const FAILED = 'failed';

    /** Enough rows for a human to act on without an unbounded JSON column. */
    public const MAX_REPORT_ROWS = 200;

    protected $fillable = [
        'rid',
        'user_id',
        'kind',
        'filename',
        'status',
        'created_count',
        'updated_count',
        'skipped_count',
        'failed_count',
        'report',
        'error',
        'started_at',
        'finished_at',
    ];

    protected $hidden = [
        'id',
    ];

    protected function casts(): array
    {
        return [
            'report' => 'array',
            'created_count' => 'integer',
            'updated_count' => 'integer',
            'skipped_count' => 'integer',
            'failed_count' => 'integer',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isFinished(): bool
    {
        return in_array($this->status, [self::DONE, self::FAILED], true);
    }

    public function isRunning(): bool
    {
        return in_array($this->status, [self::QUEUED, self::RUNNING], true);
    }

    public function durationLabel(): string
    {
        if ($this->started_at === null) {
            return 'Waiting to start';
        }

        $seconds = max(0, ($this->finished_at ?? now())->getTimestamp() - $this->started_at->getTimestamp());

        if ($seconds < 60) {
            return $seconds.'s';
        }

        return intdiv($seconds, 60).'m '.($seconds % 60).'s';
    }

    public function summaryLabel(): string
    {
        $parts = [];
        if ($this->created_count > 0) {
            $parts[] = $this->created_count.' created';
        }
        if ($this->updated_count > 0) {
            $parts[] = $this->updated_count.' updated';
        }
        if ($this->skipped_count > 0) {
            $parts[] = $this->skipped_count.' skipped';
        }
        if ($this->failed_count > 0) {
            $parts[] = $this->failed_count.' failed';
        }

        return $parts === [] ? 'Nothing was changed' : implode(', ', $parts);
    }

    /**
     * @param  list<array<string, mixed>>  $report
     */
    public function recordOutcome(array $report, ?string $error = null): void
    {
        $this->forceFill([
            'report' => array_slice($report, 0, self::MAX_REPORT_ROWS),
            'error' => $error,
            'finished_at' => now(),
            'status' => $error === null ? self::DONE : self::FAILED,
        ])->save();
    }

    public function markRunning(): void
    {
        $this->forceFill([
            'status' => self::RUNNING,
            'started_at' => now(),
        ])->save();
    }

    /**
     * @param  Builder<ProductImport>  $query
     * @return Builder<ProductImport>
     */
    public function scopeFinished(Builder $query): Builder
    {
        return $query->whereIn('status', [self::DONE, self::FAILED]);
    }

    /**
     * Reports are a paper trail, not an archive. Only finished runs are
     * prunable: a run still queued or running must survive so its outcome can
     * still be written and read.
     *
     * @return Builder<ProductImport>
     */
    public function prunable(): Builder
    {
        return static::query()->finished()->where('created_at', '<', now()->subDays(30));
    }
}
