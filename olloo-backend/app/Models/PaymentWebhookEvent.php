<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Model;

class PaymentWebhookEvent extends Model
{
    use HasRid;

    protected $fillable = [
        'rid',
        'provider',
        'external_event_id',
        'event_type',
        'payload',
        'processed_at',
    ];

    protected $hidden = [
        'id',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'processed_at' => 'datetime',
        ];
    }
}
