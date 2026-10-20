<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Precomputed delivery for one product (default variant, quantity 1) to one
 * destination. country NULL covers destinations without a country-specific
 * rule. Rebuilt by DeliveryQuoteCache; never edited by hand.
 */
class ProductDeliveryQuote extends Model
{
    protected $fillable = [
        'product_id',
        'country',
        'fee_minor',
        'is_free',
        'days_min',
        'days_max',
    ];

    protected $hidden = [
        'id',
        'product_id',
    ];

    protected function casts(): array
    {
        return [
            'fee_minor' => 'integer',
            'is_free' => 'boolean',
            'days_min' => 'integer',
            'days_max' => 'integer',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
