<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasRid;
use App\Services\DeliveryQuoteCache;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

class ProductVariant extends Model
{
    use HasRid;

    protected $fillable = [
        'rid',
        'product_id',
        'name',
        'size',
        'color',
        'sku',
        'price_minor',
        'stock_quantity',
        'handling_days',
        'is_default',
    ];

    protected $hidden = [
        'id',
    ];

    protected function casts(): array
    {
        return [
            'price_minor' => 'integer',
            'stock_quantity' => 'integer',
            'handling_days' => 'integer',
            'is_default' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        $refresh = static function (ProductVariant $variant): void {
            DB::afterCommit(static function () use ($variant): void {
                $product = Product::query()->find($variant->product_id);
                if ($product instanceof Product) {
                    app(DeliveryQuoteCache::class)->refreshProduct($product);
                }
            });
        };

        static::saved(static function (ProductVariant $variant) use ($refresh): void {
            if ($variant->wasRecentlyCreated || $variant->wasChanged(['price_minor', 'handling_days', 'is_default'])) {
                $refresh($variant);
            }
        });
        static::deleted($refresh);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** Current selling price: the variant override, else the product price. */
    public function unitPriceMinor(): int
    {
        return $this->price_minor ?? (int) $this->product->price_minor;
    }

    /** Days before dispatch: the variant's own, else the store default. */
    public function effectiveHandlingDays(): int
    {
        return $this->handling_days ?? (int) config('shipping.default_handling_days');
    }

    /** NULL stock means the variant is not stock-tracked (made to order). */
    public function tracksStock(): bool
    {
        return $this->stock_quantity !== null;
    }

    public function hasStockFor(int $quantity): bool
    {
        return ! $this->tracksStock() || $this->stock_quantity >= $quantity;
    }
}
