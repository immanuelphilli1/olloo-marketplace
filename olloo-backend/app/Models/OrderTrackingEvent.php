<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderTrackingEvent extends Model
{
    use HasRid;

    protected $fillable = [
        'rid',
        'order_id',
        'label',
        'description',
        'occurred_at',
    ];

    protected $hidden = [
        'id',
    ];

    protected function casts(): array
    {
        return [
            'occurred_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
