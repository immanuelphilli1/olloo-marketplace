<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasImageUrl;
use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class OrderItem extends Model
{
    use HasImageUrl;
    use HasRid;

    protected $fillable = [
        'rid',
        'order_id',
        'product_id',
        'product_variant_id',
        'product_rid',
        'product_name',
        'variant_name',
        'sku',
        'image',
        'unit_price_minor',
        'source_currency_code',
        'source_unit_price_minor',
        'tax_minor',
        'quantity',
    ];

    protected $hidden = [
        'id',
    ];

    protected $appends = [
        'imageUrl',
    ];

    protected function casts(): array
    {
        return [
            'unit_price_minor' => 'integer',
            'source_unit_price_minor' => 'integer',
            'tax_minor' => 'integer',
            'quantity' => 'integer',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function productVariant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class);
    }

    public function review(): HasOne
    {
        return $this->hasOne(Review::class);
    }
}
