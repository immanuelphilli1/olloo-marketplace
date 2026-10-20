<?php

declare(strict_types=1);

namespace App\Services;

use App\Currency\CurrencyConverter;
use App\Currency\ShopperLocale;
use App\Models\Category;
use App\Models\CategoryAttribute;
use App\Models\Currency;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductDeliveryQuote;
use App\Shipping\DeliveryDestination;
use App\Support\ProductMapper;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

final class ProductQueryService
{
    private const DEFAULT_LIMIT = 24;

    private const MAX_LIMIT = 100;

    public function __construct(
        private readonly DeliveryQuoteCache $deliveryQuotes,
    ) {}

    private const SPECIAL_CATEGORY_IDS = [
        'all-categories',
        'featured',
        'new-releases',
    ];

    /**
     * @return array{items: list<array<string, mixed>>, total: int, page: int, limit: int, facets: array<string, list<string>>}
     */
    public function paginate(Request $request, ?array $overrides = null): array
    {
        $filters = array_merge($this->filtersFromRequest($request), $overrides ?? []);

        $page = max(1, (int) ($filters['page'] ?? 1));
        $limit = min(self::MAX_LIMIT, max(1, (int) ($filters['limit'] ?? self::DEFAULT_LIMIT)));

        $base = $this->applyBaseFilters($this->activeQuery(), $filters);
        $values = $this->facetValues(clone $base);
        $facets = [
            ...ProductMapper::facetsFrom($values, $this->facetLabels(array_keys($values))),
            'delivery' => $this->deliveryFacets(clone $base, $filters['destination'] ?? null),
        ];

        $query = $this->applyFacetFilters(clone $base, $filters);
        $this->applySort($query, $filters['sort'] ?? null, ! empty($filters['q']));

        $total = (clone $query)->count();
        $products = $query
            ->with(['category.parent', 'tags', 'attributeValues.definition', 'defaultVariant'])
            ->forPage($page, $limit)
            ->get();

        $likedMap = $this->likedMap($request, $products);
        app(DestinationPricing::class)->attach($products, $filters['destination'] ?? null);

        return [
            'items' => $products
                ->map(fn (Product $product) => ProductMapper::toListItem(
                    $product,
                    $likedMap[$product->id] ?? null,
                ))
                ->values()
                ->all(),
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'facets' => $facets,
        ];
    }

    /**
     * @return Collection<int, Product>
     */
    public function list(Request $request, array $extra = [], ?int $limit = null): Collection
    {
        $filters = array_merge($this->filtersFromRequest($request), $extra);
        $limit = min(self::MAX_LIMIT, max(1, $limit ?? (int) ($filters['limit'] ?? self::DEFAULT_LIMIT)));

        $query = $this->applyFacetFilters(
            $this->applyBaseFilters($this->activeQuery(), $filters),
            $filters,
        );
        $this->applySort($query, $filters['sort'] ?? null, ! empty($filters['q']));

        return $query
            ->with(['category.parent', 'tags', 'attributeValues.definition', 'defaultVariant'])
            ->limit($limit)
            ->get();
    }

    public function activeQuery(): Builder
    {
        return Product::query()->where('is_active', true);
    }

    public function findActiveByRid(string $rid): ?Product
    {
        return $this->activeQuery()
            ->where('rid', $rid)
            ->with(['category.parent', 'tags', 'attributeValues.definition', 'defaultVariant', 'images', 'variants'])
            ->first();
    }

    /**
     * @return array<string, mixed>
     */
    public function filtersFromRequest(Request $request): array
    {
        return [
            'categoryId' => $request->query('categoryId'),
            'subcategory' => $request->query('subcategory'),
            'q' => $request->query('q'),
            'minPrice' => $request->query('minPrice'),
            'maxPrice' => $request->query('maxPrice'),
            'minRating' => $request->query('minRating'),
            // Delivery filters need a destination (?country= or a signed-in default address).
            'destination' => DeliveryDestination::fromRequest($request),
            'freeDelivery' => $request->boolean('freeDelivery'),
            'maxDeliveryDays' => $request->query('maxDeliveryDays'),
            'brand' => $request->query('brand'),
            'color' => $request->query('color'),
            'screenSize' => $request->query('screenSize'),
            // Any attribute: ?attributes[material]=Leather
            'attributes' => $request->query('attributes'),
            'sort' => $request->query('sort'),
            'page' => $request->query('page'),
            'limit' => $request->query('limit'),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function applyBaseFilters(Builder $query, array $filters): Builder
    {
        $categoryId = isset($filters['categoryId']) ? trim((string) $filters['categoryId']) : '';
        if ($categoryId !== '' && ! in_array($categoryId, self::SPECIAL_CATEGORY_IDS, true)) {
            $categoryIds = $this->categoryAndDescendantIds($categoryId);
            if ($categoryIds !== []) {
                $query->whereIn('category_id', $categoryIds);
            } else {
                $query->whereHas('category', function (Builder $category) use ($categoryId): void {
                    $category->where('slug', $categoryId)->orWhere('rid', $categoryId);
                });
            }
        } elseif ($categoryId === 'featured') {
            $query->where('is_featured', true);
        } elseif ($categoryId === 'new-releases') {
            $query->where('is_new_arrival', true);
        }

        // Backward compat: `subcategory` now resolves to a nested child
        // category by label, rid, or slug.
        $subcategory = isset($filters['subcategory']) ? trim((string) $filters['subcategory']) : '';
        if ($subcategory !== '') {
            $query->whereHas('category', function (Builder $cat) use ($subcategory): void {
                $cat->where('label', $subcategory)
                    ->orWhere('rid', $subcategory)
                    ->orWhere('slug', $subcategory);
            });
        }

        $q = isset($filters['q']) ? trim((string) $filters['q']) : '';
        if ($q !== '') {
            $like = '%'.$q.'%';
            $query->where(function (Builder $inner) use ($like): void {
                $inner->where('name', 'like', $like)
                    ->orWhereHas('attributeValues', fn (Builder $attributes) => $attributes->where('name', 'brand')->where('value', 'like', $like))
                    ->orWhereHas('tags', fn (Builder $tags) => $tags->where('name', 'like', $like));
            });
        }

        // minPrice/maxPrice are in the shopper's currency, matched against
        // the price as shown (converted, then rounded up to a minor unit).
        $hasMin = ($filters['minPrice'] ?? null) !== null && $filters['minPrice'] !== '';
        $hasMax = ($filters['maxPrice'] ?? null) !== null && $filters['maxPrice'] !== '';
        if ($hasMin || $hasMax) {
            $currency = app(ShopperLocale::class)->currency();
            [$price, $bindings] = $this->shopperPriceSql();

            if ($hasMin) {
                // ceil(x) >= min  <=>  x > min - 1
                $query->whereRaw("{$price} > ?", [...$bindings, $this->toMinorUnits($filters['minPrice'], $currency) - 1]);
            }

            if ($hasMax) {
                $query->whereRaw("{$price} <= ?", [...$bindings, $this->toMinorUnits($filters['maxPrice'], $currency)]);
            }
        }

        if (($filters['minRating'] ?? null) !== null && $filters['minRating'] !== '') {
            $query->where('rating', '>=', (float) $filters['minRating']);
        }

        $maxDays = isset($filters['maxDeliveryDays']) && $filters['maxDeliveryDays'] !== '' ? (int) $filters['maxDeliveryDays'] : null;
        if (! empty($filters['freeDelivery']) || $maxDays !== null) {
            $destination = $filters['destination'] ?? null;
            if ($destination === null) {
                abort(api_error('destination_required', 'Delivery filters need a destination. Pass country (for example country=AE) or sign in with a saved address.', 422));
            }

            $query->whereHas('deliveryQuotes', function (Builder $quotes) use ($filters, $maxDays, $destination): void {
                $this->whereQuoteCountry($quotes, $destination);
                if (! empty($filters['freeDelivery'])) {
                    $quotes->where('is_free', true);
                }
                if ($maxDays !== null) {
                    $quotes->where('days_max', '<=', $maxDays);
                }
            });
        }

        return $query;
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function applyFacetFilters(Builder $query, array $filters): Builder
    {
        $wanted = [];
        foreach (['brand', 'color', 'screenSize'] as $name) {
            $value = isset($filters[$name]) ? trim((string) $filters[$name]) : '';
            if ($value !== '') {
                $wanted[$name] = $value;
            }
        }

        if (is_array($filters['attributes'] ?? null)) {
            foreach ($filters['attributes'] as $name => $value) {
                if (is_string($name) && is_scalar($value) && trim((string) $value) !== '') {
                    $wanted[$name] = trim((string) $value);
                }
            }
        }

        foreach ($wanted as $name => $value) {
            $this->whereAttribute($query, $name, $value);
        }

        return $query;
    }

    /**
     * Shopper-facing names for attribute keys, from the category definitions.
     *
     * @param  list<string>  $keys
     * @return array<string, string>
     */
    private function facetLabels(array $keys): array
    {
        return CategoryAttribute::query()->whereIn('key', $keys)->orderBy('id')->pluck('label', 'key')->all();
    }

    private function whereQuoteCountry(Builder $quotes, string $destination): void
    {
        $country = $this->deliveryQuotes->quoteCountryFor($destination);
        $country === null ? $quotes->whereNull('country') : $quotes->where('country', $country);
    }

    /**
     * Delivery options across the listing for the destination: how many ship
     * free, and the delivery-day cut-offs available for the filter. Null
     * without a destination.
     *
     * @return array{freeCount: int, deliveryDays: list<int>}|null
     */
    private function deliveryFacets(Builder $base, ?string $destination): ?array
    {
        if ($destination === null) {
            return null;
        }

        $quotes = ProductDeliveryQuote::query()->whereIn('product_id', $base->select('products.id'));
        $this->whereQuoteCountry($quotes, $destination);

        return [
            'freeCount' => (clone $quotes)->where('is_free', true)->count(),
            'deliveryDays' => (clone $quotes)->distinct()->orderBy('days_max')->pluck('days_max')->map(fn ($days) => (int) $days)->all(),
        ];
    }

    private function whereAttribute(Builder $query, string $name, string $value): void
    {
        $query->whereHas('attributeValues', fn (Builder $attributes) => $attributes->where('name', $name)->where('value', $value));
    }

    /**
     * Distinct attribute values across the products a listing could show.
     *
     * @return array<string, list<string>>
     */
    private function facetValues(Builder $base): array
    {
        $values = [];
        ProductAttribute::query()
            ->whereIn('product_id', $base->select('products.id'))
            ->select(['name', 'value'])
            ->distinct()
            ->orderBy('name')
            ->orderBy('value')
            ->get()
            ->each(function (ProductAttribute $attribute) use (&$values): void {
                $values[$attribute->name][] = $attribute->value;
            });

        return $values;
    }

    public function applySort(Builder $query, ?string $sort, bool $hasSearch = false): void
    {
        $sort = $sort !== null ? strtolower(trim($sort)) : '';

        match ($sort) {
            'price_asc', 'price-asc', 'price_low', 'price-low', 'price_ascend' => $this->orderByShopperPrice($query, 'asc'),
            'price_desc', 'price-desc', 'price_high', 'price-high', 'price_descend' => $this->orderByShopperPrice($query, 'desc'),
            'rating', 'rating_desc', 'rating-desc' => $query->orderByDesc('rating'),
            'popular', 'best_selling', 'best-selling', 'sold' => $query->orderByDesc('sold_count'),
            'newest', 'new', 'created_at', 'latest' => $query->orderByDesc('created_at'),
            'name', 'name_asc' => $query->orderBy('name'),
            default => $hasSearch
                ? $query->orderByDesc('sold_count')->orderByDesc('rating')
                : $query->orderByDesc('created_at'),
        };
    }

    public function toMinorUnits(mixed $major, string $currency): int
    {
        return (int) round(((float) $major) * 10 ** app(CurrencyConverter::class)->decimalPlaces($currency));
    }

    /**
     * Products in several currencies sort by their price in the shopper's;
     * ones with no usable rate go last.
     */
    private function orderByShopperPrice(Builder $query, string $direction): void
    {
        [$price, $bindings] = $this->shopperPriceSql();

        $query->orderByRaw("{$price} is null", $bindings)->orderByRaw("{$price} {$direction}", $bindings);
    }

    /**
     * SQL for products.price_minor in the shopper's minor units, before the
     * display round-up. NULL for a currency with no usable rate. Factors are
     * numbers we computed, inlined; currency codes are bound.
     *
     * @return array{0: string, 1: list<string>}
     */
    private function shopperPriceSql(): array
    {
        $to = app(ShopperLocale::class)->currency();
        $codes = Currency::query()->orderBy('code')->pluck('code')->all();

        if ($codes === [$to]) {
            return ['price_minor', []];
        }

        $fx = app(CurrencyConverter::class);
        $cases = '';
        $bindings = [];
        foreach ($codes as $code) {
            if ($fx->canConvert($code, $to)) {
                $cases .= ' when ? then price_minor * '.sprintf('%.12F', $fx->factor($code, $to));
                $bindings[] = $code;
            }
        }

        return ["(case currency_code{$cases} else null end)", $bindings];
    }

    /**
     * Resolve a category rid/slug plus all descendant ids (any depth),
     * so filtering by a parent includes nested children.
     *
     * @return list<int>
     */
    public function categoryAndDescendantIds(string $categoryId): array
    {
        $category = Category::query()
            ->where('slug', $categoryId)
            ->orWhere('rid', $categoryId)
            ->first();

        if ($category === null) {
            return [];
        }

        return array_values(array_unique(array_merge([$category->id], $category->descendantIds())));
    }

    /**
     * @param  Collection<int, Product>  $products
     * @return array<int, bool>
     */
    public function likedMap(Request $request, Collection $products): array
    {
        $user = $request->user();
        if ($user === null || $products->isEmpty()) {
            return [];
        }

        $ids = $products->pluck('id')->all();

        $likedIds = $user->wishlists()
            ->whereIn('product_id', $ids)
            ->pluck('product_id')
            ->all();

        return array_fill_keys($likedIds, true);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function mapListItems(Request $request, Collection $products): array
    {
        $likedMap = $this->likedMap($request, $products);
        app(DestinationPricing::class)->attach($products, DeliveryDestination::fromRequest($request));

        return $products
            ->map(fn (Product $product) => ProductMapper::toListItem(
                $product,
                $likedMap[$product->id] ?? null,
            ))
            ->values()
            ->all();
    }
}
