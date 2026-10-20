<?php

declare(strict_types=1);

namespace App\Services\ProductImport;

use App\Models\Product;
use App\Models\ProductVariant;
use Generator;
use Illuminate\Database\Eloquent\Builder;

/**
 * Products as rows in the import format (ProductCsvImporter::COLUMNS), so an
 * exported file imports back unchanged: one row per option, the default option
 * first with the product's details, every option row repeating the store link
 * that groups it. Categories go out by slug, which the importer matches
 * exactly; prices in the product's own currency, as stored.
 */
final class ProductCsvExporter
{
    /**
     * @param  Builder<Product>  $products
     * @return Generator<array<string, string>>
     */
    public function rows(Builder $products): Generator
    {
        $products = $products->with(['category:id,slug', 'tags:id,name', 'shippingClass:id,name', 'variants']);

        foreach ($products->lazyById(200) as $product) {
            foreach ($product->variants->values() as $index => $variant) {
                yield [
                    'name' => $product->name,
                    'slug' => $product->slug,
                    ...($index === 0 ? $this->productColumns($product) : []),
                    ...$this->variantColumns($variant),
                ];
            }
        }
    }

    /**
     * @return array<string, string>
     */
    private function productColumns(Product $product): array
    {
        return [
            'category' => (string) $product->category?->slug,
            'price' => $this->money($product->price_minor),
            'original_price' => $this->money($product->original_price_minor),
            'tags' => $product->tags->pluck('name')->implode(';'),
            'shipping_class' => (string) $product->shippingClass?->name,
            'visible' => $product->is_active ? 'yes' : 'no',
            'featured' => $product->is_featured ? 'yes' : 'no',
            'new_arrival' => $product->is_new_arrival ? 'yes' : 'no',
            'description' => implode('|', $product->description_lines ?? []),
            'image' => (string) $product->image,
        ];
    }

    /**
     * @return array<string, string>
     */
    private function variantColumns(ProductVariant $variant): array
    {
        return [
            'sku' => $variant->sku,
            'variant_name' => $variant->name,
            'size' => (string) $variant->size,
            'color' => (string) $variant->color,
            // Blank means "the product price", which is what the column means on import.
            'variant_price' => $this->money($variant->price_minor),
            // Blank means stock is not counted (made to order).
            'stock_quantity' => $variant->stock_quantity === null ? '' : (string) $variant->stock_quantity,
            'variant_handling_days' => $variant->handling_days === null ? '' : (string) $variant->handling_days,
        ];
    }

    /** Major units with two decimals and no thousands separator, the inverse of the import's parse. */
    private function money(?int $minor): string
    {
        return $minor === null ? '' : number_format($minor / 100, 2, '.', '');
    }
}
