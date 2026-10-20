<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExternalRequestLogEntity extends Model
{
    protected $fillable = [
        'external_request_log_id',
        'entity_type',
        'entity_id',
        'entity_rid',
    ];

    protected $hidden = [
        'id',
        'external_request_log_id',
        'entity_id',
    ];

    protected function casts(): array
    {
        return [
            'entity_id' => 'integer',
        ];
    }

    public function log(): BelongsTo
    {
        return $this->belongsTo(ExternalRequestLog::class, 'external_request_log_id');
    }
}
