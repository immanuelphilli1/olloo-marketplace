<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One facet value (brand, color, screenSize, delivery, ...) for a product.
 * Never addressed on its own over the wire, so it has no rid.
 */
class ProductAttribute extends Model
{
    /** Shopper-facing name, from the category definition. */
    public function displayName(): string
    {
        return $this->definition?->label ?? $this->name;
    }

    protected $fillable = [
        'product_id',
        'category_attribute_id',
        'name',
        'value',
    ];

    protected $hidden = [
        'id',
        'product_id',
    ];

    public function definition(): BelongsTo
    {
        return $this->belongsTo(CategoryAttribute::class, 'category_attribute_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
