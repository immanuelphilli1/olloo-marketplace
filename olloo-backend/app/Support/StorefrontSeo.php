<?php

declare(strict_types=1);

namespace App\Support;

use App\Currency\CurrencyConverter;
use App\Currency\ShopperLocale;
use App\Models\Category;
use App\Models\Product;
use App\Services\ProductQueryService;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Meta tags for the storefront pages that matter to search and link previews:
 * home, the category index, one category and one product. The same answer is
 * injected into index.html by StorefrontPageController (no JS needed) and served
 * as JSON by GET /api/v1/seo for client-side navigation, so the two never drift.
 *
 * Paths are the storefront's own routes (/, /categories, /categories/{slug},
 * /products/{rid}). Anything else is not ours to describe and answers null.
 */
final class StorefrontSeo
{
    public function __construct(private readonly ProductQueryService $products) {}

    /**
     * @return array{status: int, title: string, description: string, canonical: string, image: string|null, type: string, robots: string, jsonLd: list<array<string, mixed>>}|null
     */
    public function forPath(string $path): ?array
    {
        $path = '/'.trim((string) parse_url($path, PHP_URL_PATH), '/');

        if ($path === '/') {
            return $this->home();
        }

        if ($path === '/categories') {
            return $this->page(
                'All categories | '.$this->siteName(),
                $this->sentence('Browse every category at '.$this->siteName()),
                '/categories',
            );
        }

        if (preg_match('#^/categories/([^/]+)$#', $path, $m) === 1) {
            $category = (new Category)->resolveRouteBinding(rawurldecode($m[1]));

            return $category instanceof Category && $category->is_active
                ? $this->category($category)
                : $this->notFound($path);
        }

        if (preg_match('#^/products/([^/]+)$#', $path, $m) === 1) {
            $product = $this->products->findActiveByRid(rawurldecode($m[1]));

            return $product instanceof Product ? $this->product($product) : $this->notFound($path);
        }

        return null;
    }

    public function canonical(string $path): string
    {
        $base = (string) config('services.storefront.url');
        if (! preg_match('#^https?://#i', $base)) {
            throw new RuntimeException('WEB_CLIENT_URL must be an absolute http(s) URL for canonical links.');
        }

        return rtrim($base, '/').($path === '/' ? '/' : '/'.ltrim($path, '/'));
    }

    private function home(): array
    {
        $meta = $this->page(
            $this->siteName(),
            (string) config('services.storefront.description'),
            '/',
        );
        $meta['jsonLd'] = [[
            '@context' => 'https://schema.org',
            '@type' => 'WebSite',
            'name' => $this->siteName(),
            'url' => $meta['canonical'],
        ]];

        return $meta;
    }

    private function category(Category $category): array
    {
        $children = $category->children()->where('is_active', true)->orderBy('sort_order')->pluck('label')->all();
        $description = $this->sentence('Shop '.$category->label.' at '.$this->siteName())
            .($children !== [] ? ' '.$this->sentence(implode(', ', $children)) : '');

        return $this->page(
            $category->label.' | '.$this->siteName(),
            $description,
            '/categories/'.$category->slug,
            $category->image_url,
        );
    }

    private function product(Product $product): array
    {
        $images = $product->images->sortBy('sort_order')->map(fn ($image) => $image->image_url)->filter()->values()->all();
        if ($images === [] && $product->image_url) {
            $images = [$product->image_url];
        }

        $lines = collect($product->description_lines ?? [])->filter(fn ($line) => is_string($line))->implode(' ');
        $description = trim($lines) !== ''
            ? $this->summary($lines)
            : $this->sentence($product->name.($product->category ? ' in '.$product->category->label : ''))
                .' '.$this->sentence('Shop at '.$this->siteName());

        $meta = $this->page(
            $product->name.' | '.$this->siteName(),
            $description,
            '/products/'.$product->rid,
            $images[0] ?? null,
            'product',
        );

        $currency = app(ShopperLocale::class)->displayCurrencyFor($product->currency_code);
        $price = money(app(CurrencyConverter::class)->convert((int) $product->price_minor, $product->currency_code, $currency), $currency);
        $brand = $product->attributeMap()['brand'] ?? null;

        $jsonLd = array_filter([
            '@context' => 'https://schema.org',
            '@type' => 'Product',
            'name' => $product->name,
            'image' => $images,
            'description' => $description,
            'sku' => $product->defaultVariant?->sku,
            'url' => $meta['canonical'],
            'brand' => $brand ? ['@type' => 'Brand', 'name' => $brand] : null,
            'offers' => [
                '@type' => 'Offer',
                'url' => $meta['canonical'],
                'price' => $price['amount'],
                'priceCurrency' => $price['currency'],
                'availability' => ($product->defaultVariant?->hasStockFor(1) ?? false)
                    ? 'https://schema.org/InStock'
                    : 'https://schema.org/OutOfStock',
            ],
            'aggregateRating' => $product->review_count > 0 ? [
                '@type' => 'AggregateRating',
                'ratingValue' => round((float) $product->rating, 2),
                'reviewCount' => (int) $product->review_count,
            ] : null,
        ], fn ($value) => $value !== null && $value !== []);

        $meta['jsonLd'] = [$jsonLd, $this->breadcrumbs($product, $meta['canonical'])];

        return $meta;
    }

    /** Home > parent category > category > product. */
    private function breadcrumbs(Product $product, string $productUrl): array
    {
        $trail = [['name' => $this->siteName(), 'item' => $this->canonical('/')]];
        foreach (array_filter([$product->category?->parent, $product->category]) as $category) {
            $trail[] = ['name' => $category->label, 'item' => $this->canonical('/categories/'.$category->slug)];
        }
        $trail[] = ['name' => $product->name, 'item' => $productUrl];

        return [
            '@context' => 'https://schema.org',
            '@type' => 'BreadcrumbList',
            'itemListElement' => array_map(fn ($crumb, $i) => ['@type' => 'ListItem', 'position' => $i + 1] + $crumb, $trail, array_keys($trail)),
        ];
    }

    private function notFound(string $path): array
    {
        $meta = $this->page('Page not found | '.$this->siteName(), (string) config('services.storefront.description'), $path);
        $meta['status'] = 404;
        $meta['robots'] = 'noindex';

        return $meta;
    }

    private function page(string $title, string $description, string $path, ?string $image = null, string $type = 'website'): array
    {
        return [
            'status' => 200,
            'title' => $title,
            'description' => $this->summary($description),
            'canonical' => $this->canonical($path),
            'image' => $image,
            'type' => $type,
            'robots' => 'index,follow',
            'jsonLd' => [],
        ];
    }

    /** One plain line of at most 160 characters, the length search results show. */
    private function summary(string $text): string
    {
        return Str::limit(trim((string) preg_replace('/\s+/u', ' ', strip_tags($text))), 157);
    }

    /** Ends with exactly one full stop, so "at H&CO." never becomes "H&CO..". */
    private function sentence(string $text): string
    {
        return rtrim($text, '.').'.';
    }

    private function siteName(): string
    {
        return (string) config('services.storefront.site_name');
    }
}
