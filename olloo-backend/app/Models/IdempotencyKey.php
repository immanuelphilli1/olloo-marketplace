<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;

/** Server-side record of one Idempotency-Key, never exposed on the wire. */
class IdempotencyKey extends Model
{
    use Prunable;

    protected $fillable = [
        'user_id',
        'key',
        'route',
        'request_hash',
        'response_status',
        'response_body',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'response_status' => 'integer',
            'completed_at' => 'datetime',
        ];
    }

    /** Keys are honoured for a day, matching common provider practice. */
    public function prunable(): Builder
    {
        return static::query()->where('created_at', '<', now()->subDay());
    }
}
