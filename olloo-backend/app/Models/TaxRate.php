<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One tax component a destination country charges, in basis points
 * (500 = 5%). Applies to products of its tax class (NULL = standard).
 */
class TaxRate extends Model
{
    use HasRid;

    protected $fillable = [
        'rid',
        'name',
        'country',
        'tax_class_id',
        'rate_bp',
        'is_compound',
        'applies_to_shipping',
        'sort_order',
        'is_active',
    ];

    protected $hidden = [
        'id',
    ];

    protected function casts(): array
    {
        return [
            'rate_bp' => 'integer',
            'is_compound' => 'boolean',
            'applies_to_shipping' => 'boolean',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function taxClass(): BelongsTo
    {
        return $this->belongsTo(TaxClass::class);
    }

    public function percent(): float
    {
        return $this->rate_bp / 100;
    }
}
