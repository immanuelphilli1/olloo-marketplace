<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Currency\CurrencyConverter;
use App\Currency\ShopperLocale;
use App\Http\Controllers\Controller;
use App\Models\BrowsingHistory;
use App\Models\Category;
use App\Models\Product;
use App\Models\Review;
use App\Services\DestinationPricing;
use App\Services\ProductQueryService;
use App\Services\ShippingService;
use App\Shipping\DeliveryDestination;
use App\Shipping\ShippingConfigurationException;
use App\Shipping\ShippingLine;
use App\Support\ProductMapper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ProductController extends Controller
{
    public function __construct(
        private readonly ProductQueryService $products,
        private readonly ShippingService $shipping,
        private readonly ShopperLocale $locale,
        private readonly CurrencyConverter $fx,
    ) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->products->paginate($request));
    }

    public function featured(Request $request): JsonResponse
    {
        $limit = min(100, max(1, (int) $request->query('limit', 12)));
        $items = $this->products->list($request, [
            'categoryId' => 'featured',
            'sort' => 'newest',
        ], $limit);

        return response()->json([
            'items' => $this->products->mapListItems($request, $items),
        ]);
    }

    public function newArrivals(Request $request): JsonResponse
    {
        $limit = min(100, max(1, (int) $request->query('limit', 12)));
        $items = $this->products->list($request, [
            'categoryId' => 'new-releases',
            'sort' => 'newest',
        ], $limit);

        return response()->json([
            'items' => $this->products->mapListItems($request, $items),
        ]);
    }

    public function show(Request $request, Product $product): JsonResponse
    {
        if (! $product->is_active) {
            abort(404);
        }

        $product->load(['category.parent', 'tags', 'attributeValues.definition', 'defaultVariant', 'images' => fn ($q) => $q->orderBy('sort_order'), 'variants']);

        $destination = DeliveryDestination::fromRequest($request);
        app(DestinationPricing::class)->attach([$product], $destination);

        $payload = ProductMapper::toDetail($product, $this->variantQuotes($product, $destination));
        $liked = $this->products->likedMap($request, collect([$product]));
        $payload['product']['liked'] = $liked[$product->id] ?? null;
        $payload['family'] = $this->family($product, $destination);

        return response()->json($payload);
    }

    /**
     * Sibling products in the same family (for example one TV model in several
     * sizes), offered as options on the product page. Null unless at least two
     * active products share the key, so a lone product shows no selector.
     *
     * @return array{optionName: string, options: list<array<string, mixed>>}|null
     */
    private function family(Product $product, ?string $destination): ?array
    {
        if ($product->family_key === null || $product->family_key === '') {
            return null;
        }

        $members = $this->products->activeQuery()
            ->where('family_key', $product->family_key)
            ->with(['category.parent', 'tags', 'attributeValues.definition', 'defaultVariant'])
            ->get();

        if ($members->count() < 2) {
            return null;
        }

        app(DestinationPricing::class)->attach($members->all(), $destination);

        $options = $members
            ->map(function (Product $member) use ($product): array {
                $card = ProductMapper::toListItem($member);

                return [
                    'rid' => $member->rid,
                    'value' => $member->family_option_value ?: $member->name,
                    'priceMoney' => $card['priceMoney'],
                    'originalPriceMoney' => $card['originalPriceMoney'],
                    'inStock' => $card['inStock'],
                    'imageUrl' => $card['imageUrl'] ?? null,
                    'isCurrent' => $member->id === $product->id,
                ];
            })
            // Natural order, so 32" < 43" < 55" and 7kg < 10kg.
            ->sort(fn (array $a, array $b) => strnatcasecmp($a['value'], $b['value']))
            ->values()
            ->all();

        return [
            'optionName' => $product->family_option_name ?: 'Size',
            'options' => $options,
        ];
    }

    public function related(Request $request, Product $product): JsonResponse
    {
        if (! $product->is_active) {
            abort(404);
        }

        $limit = min(100, max(1, (int) $request->query('limit', 8)));

        $query = $this->products->activeQuery()
            ->where('id', '!=', $product->id)
            ->with(['category.parent', 'tags', 'attributeValues.definition', 'defaultVariant']);

        $query->where(function ($q) use ($product): void {
            $q->where('category_id', $product->category_id);
            if ($product->category?->parent_id) {
                // Siblings under the same parent (e.g. other Shoes under Fashion).
                $siblingIds = Category::query()
                    ->where('parent_id', $product->category->parent_id)
                    ->pluck('id')
                    ->all();
                if ($siblingIds !== []) {
                    $q->orWhereIn('category_id', $siblingIds);
                }
            }
        });

        $items = $query
            ->orderByDesc('sold_count')
            ->orderByDesc('rating')
            ->limit($limit)
            ->get();

        return response()->json([
            'items' => $this->products->mapListItems($request, $items),
        ]);
    }

    public function reviews(Request $request, Product $product): JsonResponse
    {
        if (! $product->is_active) {
            abort(404);
        }

        $page = max(1, (int) $request->query('page', 1));
        $limit = min(100, max(1, (int) $request->query('limit', 10)));

        $query = Review::query()
            ->where('product_id', $product->id)
            ->where('is_approved', true)
            ->orderByDesc('created_at');

        $total = (clone $query)->count();
        $avgRating = (float) (clone $query)->avg('rating');
        $reviews = $query->forPage($page, $limit)->get();

        // The signed-in shopper sees their own review even while it waits for
        // approval, so a review they just wrote does not seem to vanish.
        $viewer = $request->user('sanctum');
        $mine = $viewer === null ? null : Review::query()
            ->where('product_id', $product->id)
            ->where('user_id', $viewer->id)
            ->latest('id')
            ->first();

        return response()->json([
            'reviews' => $reviews->map(fn (Review $review) => ProductMapper::reviewToArray($review))->values()->all(),
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'avgRating' => round($avgRating, 1),
            'myReview' => $mine === null ? null : [
                ...ProductMapper::reviewToArray($mine),
                'status' => $mine->is_approved ? 'published' : 'pending',
            ],
        ]);
    }

    public function recommendations(Request $request): JsonResponse
    {
        $limit = min(100, max(1, (int) $request->query('limit', 8)));
        $user = $request->user();

        $items = collect();

        if ($user !== null) {
            $recentProductIds = BrowsingHistory::query()
                ->where('user_id', $user->id)
                ->orderByDesc('viewed_at')
                ->limit(20)
                ->pluck('product_id')
                ->unique()
                ->values();

            if ($recentProductIds->isNotEmpty()) {
                $categoryIds = Product::query()
                    ->whereIn('id', $recentProductIds)
                    ->pluck('category_id')
                    ->unique()
                    ->filter()
                    ->values();

                $items = $this->products->activeQuery()
                    ->whereIn('category_id', $categoryIds)
                    ->whereNotIn('id', $recentProductIds)
                    ->with(['category.parent', 'tags', 'attributeValues.definition', 'defaultVariant'])
                    ->orderByDesc('sold_count')
                    ->orderByDesc('rating')
                    ->limit($limit)
                    ->get();
            }
        }

        if ($items->isEmpty()) {
            $items = $this->products->list($request, [
                'categoryId' => 'featured',
                'sort' => 'popular',
            ], $limit);
        }

        return response()->json([
            'items' => $this->products->mapListItems($request, $items),
        ]);
    }

    /**
     * Delivery per variant (handling time and price can differ) for the
     * shopper's destination. Nothing without a destination; a variant with no
     * matching rule is left out rather than given a made-up fee.
     *
     * @return array<string, array<string, mixed>>
     */
    private function variantQuotes(Product $product, ?string $destination): array
    {
        if ($destination === null) {
            return [];
        }

        // Quoted in the currency the variant's price is shown in.
        $currency = $this->locale->displayCurrencyFor($product->currency_code);
        $quotes = [];
        foreach ($product->variants as $variant) {
            $variant->setRelation('product', $product);
            try {
                $quotes[$variant->rid] = $this->shipping->quoteLines($currency, $destination, [
                    new ShippingLine(
                        $this->fx->convert($variant->unitPriceMinor(), $product->currency_code, $currency),
                        $product->shipping_class_id,
                        $variant->effectiveHandlingDays(),
                    ),
                ]);
            } catch (ShippingConfigurationException) {
                continue;
            }
        }

        return $quotes;
    }
}
