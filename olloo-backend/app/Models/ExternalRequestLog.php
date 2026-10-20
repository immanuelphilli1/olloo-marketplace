<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExternalRequestLog extends Model
{
    use HasRid;

    protected $fillable = [
        'rid',
        'direction',
        'service',
        'action',
        'request_method',
        'request_url',
        'status_code',
        'success',
        'duration_ms',
        'request_headers',
        'request_body',
        'response_headers',
        'response_body',
        'exception_class',
        'exception_message',
        'user_id',
        'guard',
        'meta',
    ];

    protected $hidden = [
        'id',
        'user_id',
    ];

    protected function casts(): array
    {
        return [
            'success' => 'boolean',
            'status_code' => 'integer',
            'duration_ms' => 'integer',
            'meta' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function entities(): HasMany
    {
        return $this->hasMany(ExternalRequestLogEntity::class);
    }
}
