<?php

declare(strict_types=1);

namespace App\Support;

use App\Currency\CurrencyConverter;
use App\Currency\ShopperLocale;
use App\Models\Product;
use App\Models\Review;

/**
 * Storefront product shapes. Every amount is shown in the shopper's currency
 * (ShopperLocale), converted from the product's own currency at the shopper
 * rate; with no usable rate it stays in the product's currency.
 */
final class ProductMapper
{
    public static function toListItem(Product $product, ?bool $liked = null): array
    {
        $discountPercent = null;
        if ($product->original_price_minor && $product->original_price_minor > $product->price_minor) {
            $discountPercent = (int) round((1 - ($product->price_minor / $product->original_price_minor)) * 100);
        }

        $attributes = $product->attributeMap();
        $tagNames = $product->relationLoaded('tags')
            ? $product->tags->pluck('name')->values()->all()
            : [];

        return [
            'rid' => $product->rid,
            'categoryId' => $product->category?->slug ?? $product->category?->rid,
            'subcategory' => $product->category?->parent?->label ?? '',
            'image' => $product->image,
            'imageUrl' => $product->image_url,
            // The first tag in display order is the storefront badge.
            'tags' => $tagNames,
            'category' => $product->category?->label ?? '',
            'name' => $product->name,
            'priceMoney' => self::price($product, (int) $product->price_minor),
            // Prices are tax-exclusive. For a known destination: the price with
            // its tax (show this where consumer prices must include VAT).
            'priceInclTaxMoney' => self::withTax($product, (int) $product->price_minor),
            'taxRatePercent' => self::taxBp($product) !== null ? self::taxBp($product) / 100 : null,
            'originalPriceMoney' => $product->original_price_minor
                ? self::price($product, (int) $product->original_price_minor)
                : null,
            'discountPercent' => $discountPercent,
            // Worked out from shipping for the shopper's destination; null when
            // the destination is unknown or no shipping rule applies.
            'deliveryQuote' => self::deliveryQuote($product),
            'ratingValue' => self::displayRating($product),
            'reviewCount' => (int) $product->review_count,
            'soldCount' => (int) $product->sold_count,
            'liked' => $liked,
            'inStock' => $product->defaultVariant?->hasStockFor(1) ?? false,
            'brand' => $attributes['brand'] ?? null,
            'color' => $attributes['color'] ?? null,
            'screenSize' => $attributes['screenSize'] ?? null,
            // Every attribute with its display name, in category order.
            'attributes' => $product->displayAttributes(),
        ];
    }

    /**
     * @param  array<string, array<string, mixed>>  $variantQuotes  variant rid => ShippingService quote, for the shopper's destination
     */
    public static function toDetail(Product $product, array $variantQuotes = []): array
    {
        $quote = $product->relationLoaded('deliveryQuote') ? $product->deliveryQuote : null;

        $images = $product->images->pluck('path')->values()->all();
        if ($images === [] && $product->image) {
            $images = [$product->image];
        }

        // One ordered gallery; `imageUrls` and every `imageIndex` index into it.
        $variantRids = $product->variants->pluck('rid', 'id');
        $gallery = $product->images
            ->filter(fn ($image) => $image->image_url)
            ->map(fn ($image) => [
                'rid' => $image->rid,
                'imageUrl' => $image->image_url,
                'variantRid' => $variantRids[$image->variant_id] ?? null,
            ])->values()->all();
        if ($gallery === [] && $product->image_url) {
            $gallery = [['rid' => null, 'imageUrl' => $product->image_url, 'variantRid' => null]];
        }
        $imageUrls = array_column($gallery, 'imageUrl');
        $firstImageOf = [];
        foreach ($gallery as $index => $image) {
            if ($image['variantRid'] !== null) {
                $firstImageOf[$image['variantRid']] ??= $index;
            }
        }

        return [
            'product' => self::toListItem($product),
            'images' => $images,
            'imageUrls' => $imageUrls,
            'gallery' => $gallery,
            'ratingValue' => self::displayRating($product),
            'reviewCount' => $product->review_count,
            'soldCount' => $product->sold_count,
            'priceMoney' => self::price($product, (int) $product->price_minor),
            'priceCurrency' => self::displayCurrency($product),
            'discountNotice' => $product->discount_notice,
            'modelOptions' => $product->variants->pluck('name')->values()->all(),
            // Colour and size pick separately; a group appears only when some variant sets it.
            'optionGroups' => self::optionGroups($product),
            'variantOptions' => $product->variants->map(fn ($v) => [
                'rid' => $v->rid,
                'name' => $v->name,
                'size' => $v->size,
                'color' => $v->color,
            ])->values()->all(),
            'variants' => $product->variants->map(fn ($v) => [
                'rid' => $v->rid,
                'name' => $v->name,
                'size' => $v->size,
                'color' => $v->color,
                'sku' => $v->sku,
                'priceMoney' => self::price($product, (int) ($v->price_minor ?? $product->price_minor)),
                'priceInclTaxMoney' => self::withTax($product, (int) ($v->price_minor ?? $product->price_minor)),
                'isDefault' => $v->is_default,
                // null: not stock-tracked (made to order).
                'stockQuantity' => $v->stock_quantity,
                'inStock' => $v->hasStockFor(1),
                'handlingDays' => $v->effectiveHandlingDays(),
                'deliveryQuote' => isset($variantQuotes[$v->rid]) ? self::quoteFromShipping($variantQuotes[$v->rid]) : null,
                // Gallery index of this variant's first photo; null when none is tagged.
                'imageIndex' => $firstImageOf[$v->rid] ?? null,
            ])->values()->all(),
            'descriptionLines' => $product->description_lines ?? [],
            'shippingFeeMoney' => $quote ? self::price($product, (int) $quote->fee_minor) : null,
            'deliveryDays' => $quote ? ['min' => $quote->days_min, 'max' => $quote->days_max] : null,
        ];
    }

    /**
     * @return list<array{key: string, label: string, values: list<string>}>
     */
    private static function optionGroups(Product $product): array
    {
        $groups = [];
        foreach (['color' => 'Color', 'size' => 'Size'] as $key => $label) {
            $values = $product->variants->pluck($key)->filter(fn ($value) => $value !== null && $value !== '')->unique()->values()->all();
            if ($values !== []) {
                $groups[] = ['key' => $key, 'label' => $label, 'values' => $values];
            }
        }

        return $groups;
    }

    /**
     * @return array{free: bool, fee: array{amount: float|int, currency: string}, minDays: int, maxDays: int}|null
     */
    private static function deliveryQuote(Product $product): ?array
    {
        $quote = $product->relationLoaded('deliveryQuote') ? $product->deliveryQuote : null;

        return $quote ? [
            'free' => $quote->is_free,
            'fee' => self::price($product, (int) $quote->fee_minor),
            'minDays' => $quote->days_min,
            'maxDays' => $quote->days_max,
        ] : null;
    }

    private static function taxBp(Product $product): ?int
    {
        return $product->relationLoaded('destinationTaxBp') ? $product->getRelation('destinationTaxBp') : null;
    }

    /**
     * @return array{amount: float|int, currency: string}|null
     */
    private static function withTax(Product $product, int $priceMinor): ?array
    {
        $bp = self::taxBp($product);
        if ($bp === null) {
            return null;
        }

        $currency = self::displayCurrency($product);
        $shown = app(CurrencyConverter::class)->convert($priceMinor, $product->currency_code, $currency);

        return money($shown + (int) round($shown * $bp / 10000), $currency);
    }

    /**
     * An amount stored in the product's currency, as the shopper sees it.
     *
     * @return array{amount: float|int, currency: string}
     */
    private static function price(Product $product, int $minor): array
    {
        $currency = self::displayCurrency($product);

        return money(app(CurrencyConverter::class)->convert($minor, $product->currency_code, $currency), $currency);
    }

    private static function displayCurrency(Product $product): string
    {
        return app(ShopperLocale::class)->displayCurrencyFor($product->currency_code);
    }

    /**
     * @param  array<string, mixed>  $quote  from ShippingService
     * @return array{free: bool, fee: array{amount: float|int, currency: string}, minDays: int, maxDays: int}|null
     */
    private static function quoteFromShipping(array $quote): ?array
    {
        if ($quote['deliveryDays'] === null) {
            return null;
        }

        return [
            'free' => $quote['free'],
            'fee' => money($quote['feeMinor'], $quote['currency']),
            'minDays' => $quote['deliveryDays']['min'],
            'maxDays' => $quote['deliveryDays']['max'],
        ];
    }

    /**
     * Stars shown for a product: the approved-review average, or five while it
     * has no reviews yet. The stored `rating` stays the true average (0 with no
     * reviews), so sorting by rating still ranks reviewed products by merit;
     * `reviewCount` is sent alongside so a client can say "no reviews yet".
     */
    public static function displayRating(Product $product): float
    {
        return (int) $product->review_count > 0 ? round((float) $product->rating, 2) : 5.0;
    }

    public static function reviewToArray(Review $review): array
    {
        return [
            'rid' => $review->rid,
            'author' => $review->author_display,
            'location' => $review->location,
            'createdAt' => optional($review->created_at)?->toIso8601String(),
            'rating' => $review->rating,
            'text' => $review->body,
            'title' => $review->title,
        ];
    }

    /**
     * Facet values per attribute name. Named keys stay for existing clients;
     * `attributes` carries every attribute, including new ones.
     *
     * @param  array<string, list<string>>  $valuesByName
     * @param  array<string, string>  $labels  attribute key => label
     * @return array<string, mixed>
     */
    public static function facetsFrom(array $valuesByName, array $labels = []): array
    {
        return [
            'brands' => $valuesByName['brand'] ?? [],
            'colors' => $valuesByName['color'] ?? [],
            'screenSizes' => $valuesByName['screenSize'] ?? [],
            'attributes' => (object) $valuesByName,
            'attributeLabels' => (object) $labels,
        ];
    }
}
