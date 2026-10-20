<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Model;

/**
 * Mid-market rate for one direction of a currency pair. `markup_percent` is
 * the staff override for this pair (NULL: the store default applies).
 */
class CurrencyConversion extends Model
{
    use HasRid;

    protected $fillable = [
        'rid',
        'from_currency_code',
        'to_currency_code',
        'rate',
        'markup_percent',
        'fetched_at',
        'source',
    ];

    protected $hidden = [
        'id',
    ];

    protected function casts(): array
    {
        return [
            'rate' => 'decimal:12',
            'markup_percent' => 'decimal:3',
            'fetched_at' => 'datetime',
        ];
    }
}
