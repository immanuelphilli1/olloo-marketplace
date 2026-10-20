<?php

declare(strict_types=1);

namespace App\Models;

use App\Currency\CurrencyConverter;
use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CartItem extends Model
{
    use HasRid;

    protected $fillable = [
        'rid',
        'cart_id',
        'product_id',
        'product_variant_id',
        'quantity',
        'selected',
        'unit_price_minor',
    ];

    protected $hidden = [
        'id',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'selected' => 'boolean',
            'unit_price_minor' => 'integer',
        ];
    }

    public function cart(): BelongsTo
    {
        return $this->belongsTo(Cart::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function productVariant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class);
    }

    /**
     * What the line costs today. `unit_price_minor` is the price the customer
     * last saw; checkout refuses to charge when the two differ.
     */
    public function currentUnitPriceMinor(): int
    {
        return $this->productVariant->price_minor ?? (int) $this->product->price_minor;
    }

    /**
     * Today's price in the cart's (shopper's) currency. Stored prices stay in
     * the product's currency, so a rate refresh never trips priceChanged().
     */
    public function unitPriceMinorIn(string $currency): int
    {
        return app(CurrencyConverter::class)->convert($this->currentUnitPriceMinor(), $this->product->currency_code, $currency);
    }

    public function priceChanged(): bool
    {
        return $this->currentUnitPriceMinor() !== (int) $this->unit_price_minor;
    }

    public function isPurchasable(): bool
    {
        return $this->product !== null && $this->product->is_active && $this->productVariant !== null;
    }
}
