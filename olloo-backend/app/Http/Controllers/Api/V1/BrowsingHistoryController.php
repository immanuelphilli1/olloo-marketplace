<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BrowsingHistory;
use App\Models\Product;
use App\Services\DestinationPricing;
use App\Shipping\DeliveryDestination;
use App\Support\ProductMapper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

final class BrowsingHistoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $entries = BrowsingHistory::query()
            ->where('user_id', $user->id)
            ->with(['product.category.parent', 'product.tags', 'product.attributeValues.definition', 'product.defaultVariant'])
            ->orderByDesc('viewed_at')
            ->get();

        app(DestinationPricing::class)->attach($entries->pluck('product')->filter(), DeliveryDestination::fromRequest($request));

        $todayStart = Carbon::today();
        $yesterdayStart = Carbon::yesterday();

        $buckets = [
            'today' => ['id' => 'today', 'label' => 'Today', 'items' => []],
            'yesterday' => ['id' => 'yesterday', 'label' => 'Yesterday', 'items' => []],
            'older' => ['id' => 'older', 'label' => 'Older', 'items' => []],
        ];

        foreach ($entries as $entry) {
            if (! $entry->product || ! $entry->product->is_active) {
                continue;
            }

            $viewedAt = $entry->viewed_at ?? $entry->created_at;
            $item = [
                'rid' => $entry->rid,
                'viewedAt' => optional($viewedAt)?->toIso8601String(),
                'product' => ProductMapper::toListItem($entry->product),
            ];

            if ($viewedAt && $viewedAt->gte($todayStart)) {
                $buckets['today']['items'][] = $item;
            } elseif ($viewedAt && $viewedAt->gte($yesterdayStart)) {
                $buckets['yesterday']['items'][] = $item;
            } else {
                $buckets['older']['items'][] = $item;
            }
        }

        $sections = array_values(array_filter(
            $buckets,
            static fn (array $section): bool => $section['items'] !== [],
        ));

        return response()->json(['sections' => $sections]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'productId' => ['required', 'string'],
        ]);

        $product = Product::query()
            ->where('rid', $data['productId'])
            ->where('is_active', true)
            ->first();

        if (! $product) {
            return api_error('product_not_found', 'Product not found.', 404);
        }

        $user = $request->user();
        $guestToken = $this->guestToken($request);

        if (! $user && ($guestToken === null || $guestToken === '')) {
            return api_error('guest_token_required', 'Provide authentication or a guest cart id.', 401);
        }

        $query = BrowsingHistory::query()->where('product_id', $product->id);

        if ($user) {
            $query->where('user_id', $user->id);
        } else {
            $query->whereNull('user_id')->where('guest_token', $guestToken);
        }

        $entry = $query->first();

        if ($entry) {
            $entry->update(['viewed_at' => now()]);
        } else {
            $entry = BrowsingHistory::query()->create([
                'user_id' => $user?->id,
                'guest_token' => $user ? null : $guestToken,
                'product_id' => $product->id,
                'viewed_at' => now(),
            ]);
        }

        return response()->json([
            'success' => true,
            'rid' => $entry->rid,
            'productId' => $product->rid,
        ], 201);
    }

    public function destroy(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'string'],
        ]);

        BrowsingHistory::query()
            ->where('user_id', $request->user()->id)
            ->whereIn('rid', $data['ids'])
            ->delete();

        return response()->json(['success' => true]);
    }

    public function destroyAll(Request $request): JsonResponse
    {
        BrowsingHistory::query()
            ->where('user_id', $request->user()->id)
            ->delete();

        return response()->json(['success' => true]);
    }

    private function guestToken(Request $request): ?string
    {
        $token = $request->header('X-Cart-Id') ?: $request->cookie('cart_id');

        return is_string($token) && $token !== '' ? $token : null;
    }
}
