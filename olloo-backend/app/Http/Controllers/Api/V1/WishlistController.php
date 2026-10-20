<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Wishlist;
use App\Services\DestinationPricing;
use App\Shipping\DeliveryDestination;
use App\Support\ProductMapper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class WishlistController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $wishlistProductIds = Wishlist::query()
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->pluck('product_id');

        if ($wishlistProductIds->isEmpty()) {
            return response()->json(['items' => []]);
        }

        $query = Product::query()
            ->where('is_active', true)
            ->whereIn('id', $wishlistProductIds)
            ->with(['category.parent', 'tags', 'attributeValues.definition', 'defaultVariant']);

        if ($request->filled('category')) {
            $category = (string) $request->query('category');
            $query->whereHas('category', function ($q) use ($category): void {
                $q->where('rid', $category)->orWhere('slug', $category);
            });
        }

        if ($request->filled('minRating')) {
            $minRating = (float) $request->query('minRating');
            $query->where('rating', '>=', $minRating);
        }

        $order = $wishlistProductIds->flip();

        $items = $query
            ->get()
            ->sortBy(fn (Product $product): int => (int) ($order[$product->id] ?? PHP_INT_MAX))
            ->values()
            ->tap(fn ($products) => app(DestinationPricing::class)->attach($products, DeliveryDestination::fromRequest($request)))
            ->map(fn (Product $product): array => ProductMapper::toListItem($product, true))
            ->all();

        return response()->json(['items' => $items]);
    }

    public function store(Request $request, string $productId): JsonResponse
    {
        $user = $request->user();

        $product = Product::query()
            ->where('rid', $productId)
            ->where('is_active', true)
            ->first();

        if (! $product) {
            return api_error('product_not_found', 'Product not found.', 404);
        }

        Wishlist::query()->firstOrCreate(
            [
                'user_id' => $user->id,
                'product_id' => $product->id,
            ],
        );

        return response()->json([
            'success' => true,
            'productRid' => $product->rid,
        ], 201);
    }

    public function destroy(Request $request, string $productId): JsonResponse
    {
        $user = $request->user();

        $product = Product::query()->where('rid', $productId)->first();

        if (! $product) {
            return api_error('product_not_found', 'Product not found.', 404);
        }

        Wishlist::query()
            ->where('user_id', $user->id)
            ->where('product_id', $product->id)
            ->delete();

        return response()->json(['success' => true]);
    }

    public function categories(Request $request): JsonResponse
    {
        $user = $request->user();

        $categories = DB::table('wishlists')
            ->join('products', 'products.id', '=', 'wishlists.product_id')
            ->join('categories', 'categories.id', '=', 'products.category_id')
            ->where('wishlists.user_id', $user->id)
            ->where('products.is_active', true)
            ->select('categories.rid', 'categories.slug', 'categories.label', 'categories.sort_order')
            ->distinct()
            ->orderBy('categories.sort_order')
            ->orderBy('categories.label')
            ->get()
            ->map(fn ($row): array => [
                'rid' => $row->rid,
                'slug' => $row->slug,
                'label' => $row->label,
            ])
            ->values()
            ->all();

        return response()->json(['categories' => $categories]);
    }
}
