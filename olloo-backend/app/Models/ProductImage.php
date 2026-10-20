<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasImageUrl;
use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductImage extends Model
{
    use HasImageUrl;
    use HasRid;

    protected $fillable = [
        'rid',
        'product_id',
        'variant_id',
        'path',
        'sort_order',
    ];

    protected $hidden = [
        'id',
    ];

    protected $appends = [
        'imageUrl',
    ];

    protected function imageUrlColumn(): string
    {
        return 'path';
    }

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** The variant this photo shows, if any; the storefront slides to it on selection. */
    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class);
    }
}
