<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Tax an order charged for one component, frozen at order time. */
class OrderTaxLine extends Model
{
    protected $fillable = [
        'order_id',
        'name',
        'country',
        'rate_bp',
        'is_compound',
        'taxable_minor',
        'amount_minor',
    ];

    protected $hidden = [
        'id',
        'order_id',
    ];

    protected function casts(): array
    {
        return [
            'rate_bp' => 'integer',
            'is_compound' => 'boolean',
            'taxable_minor' => 'integer',
            'amount_minor' => 'integer',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
