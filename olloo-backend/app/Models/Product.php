<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasImageUrl;
use App\Models\Concerns\HasRid;
use App\Services\DeliveryQuoteCache;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class Product extends Model
{
    use HasImageUrl;
    use HasRid;

    protected $fillable = [
        'rid',
        'slug',
        'category_id',
        'family_key',
        'family_option_name',
        'family_option_value',
        'shipping_class_id',
        'tax_class_id',
        'name',
        'image',
        'display',
        'price_minor',
        'original_price_minor',
        'currency_code',
        'rating',
        'review_count',
        'sold_count',
        'discount_notice',
        'description_lines',
        'is_featured',
        'is_new_arrival',
        'is_active',
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
            'price_minor' => 'integer',
            'original_price_minor' => 'integer',
            'rating' => 'decimal:2',
            'review_count' => 'integer',
            'sold_count' => 'integer',
            'description_lines' => 'array',
            'display' => 'array',
            'is_featured' => 'boolean',
            'is_new_arrival' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        // Delivery quotes depend on price, currency, class and visibility.
        static::saved(static function (Product $product): void {
            if (! $product->wasRecentlyCreated && $product->wasChanged(['price_minor', 'currency_code', 'shipping_class_id'])) {
                DB::afterCommit(static fn () => app(DeliveryQuoteCache::class)->refreshProduct($product->fresh()));
            }
        });
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * @return BelongsToMany<Tag>
     */
    /** In display order; the first tag is the storefront badge. */
    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class)->withPivot('position')->orderByPivot('position');
    }

    /**
     * Replace the product's tags, keeping the given order.
     *
     * @param  list<int>  $tagIds
     */
    public function syncTagsInOrder(array $tagIds): void
    {
        $this->tags()->sync(collect(array_values($tagIds))->mapWithKeys(fn (int $id, int $position) => [$id => ['position' => $position]])->all());
        $this->unsetRelation('tags');
    }

    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class);
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class)->orderByDesc('is_default')->orderBy('id');
    }

    public function taxClass(): BelongsTo
    {
        return $this->belongsTo(TaxClass::class);
    }

    public function shippingClass(): BelongsTo
    {
        return $this->belongsTo(ShippingClass::class);
    }

    public function deliveryQuotes(): HasMany
    {
        return $this->hasMany(ProductDeliveryQuote::class);
    }

    public function defaultVariant(): HasOne
    {
        return $this->hasOne(ProductVariant::class)->where('is_default', true);
    }

    public function attributeValues(): HasMany
    {
        return $this->hasMany(ProductAttribute::class)->orderBy('name');
    }

    /**
     * Facet attributes as name => value (brand, color, screenSize, delivery, ...).
     *
     * @return array<string, string>
     */
    public function attributeMap(): array
    {
        return $this->attributeValues->pluck('value', 'name')->all();
    }

    /**
     * Set attribute values by key. Each key must be defined on the product's
     * category or an ancestor; blank values remove the attribute.
     *
     * @param  array<string, string|null>  $attributes
     */
    public function syncAttributes(array $attributes): void
    {
        $definitions = $this->category->availableAttributes()->keyBy('key');

        foreach ($attributes as $name => $value) {
            $value = trim((string) $value);
            if ($value === '') {
                $this->attributeValues()->where('name', $name)->delete();

                continue;
            }

            $definition = $definitions->get($name);
            if ($definition === null) {
                throw new InvalidArgumentException("Category \"{$this->category->label}\" does not offer the attribute \"{$name}\". Add it to the category first.");
            }

            $this->attributeValues()->updateOrCreate(
                ['name' => $name],
                ['value' => $value, 'category_attribute_id' => $definition->id],
            );
        }

        $this->unsetRelation('attributeValues');
    }

    /**
     * Attribute values with their display names, in the order the category
     * lists them (product-level ones such as delivery last).
     *
     * @return list<array{key: string, label: string, value: string}>
     */
    public function displayAttributes(): array
    {
        return $this->attributeValues
            ->sortBy(fn (ProductAttribute $attribute) => [
                $attribute->definition === null ? 1 : 0,
                $attribute->definition?->sort_order ?? 0,
                $attribute->displayName(),
            ])
            ->map(fn (ProductAttribute $attribute) => [
                'key' => $attribute->name,
                'label' => $attribute->displayName(),
                'value' => $attribute->value,
            ])
            ->values()
            ->all();
    }

    /** Storefront presentation hint from the `display` JSON column. */
    public function displayOption(string $key, mixed $default = null): mixed
    {
        return is_array($this->display) && array_key_exists($key, $this->display) ? $this->display[$key] : $default;
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }
}
