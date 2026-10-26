<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\OrderPaymentStatus;
use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Models\OrderItem;
use App\Models\Review;
use App\Support\ProductMapper;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ReviewController extends Controller
{
    public function waiting(Request $request): JsonResponse
    {
        $user = $request->user();

        $items = OrderItem::query()
            ->whereDoesntHave('review')
            ->whereHas('order', fn ($query) => $this->boughtBy($query, $user->id))
            ->with(['order', 'product.category.parent', 'product.tags', 'product.attributeValues.definition', 'product.defaultVariant'])
            ->orderByDesc('id')
            ->get()
            ->map(function (OrderItem $item): array {
                $order = $item->order;
                $currency = (string) $order?->currency_code;
                $deliveredAt = $order?->delivered_at ?? $order?->shipped_at ?? $order?->placed_at ?? $order?->updated_at;

                $payload = [
                    'rid' => $item->rid,
                    'productName' => $item->product_name,
                    'productImage' => $item->image,
                    'productImageUrl' => $item->image_url,
                    'orderId' => $order?->order_reference ?? $order?->rid,
                    'deliveredAt' => $deliveredAt?->toIso8601String(),
                    'priceCurrency' => $currency,
                    'priceMoney' => money($item->unit_price_minor, $currency),
                    'quantity' => $item->quantity,
                ];

                if ($item->product) {
                    $payload['product'] = ProductMapper::toListItem($item->product);
                }

                return $payload;
            })
            ->values()
            ->all();

        return response()->json(['items' => $items]);
    }

    public function reviewed(Request $request): JsonResponse
    {
        $user = $request->user();

        $reviews = Review::query()
            ->where('user_id', $user->id)
            ->with(['product.category.parent', 'product.tags', 'product.attributeValues.definition', 'product.defaultVariant', 'orderItem.order'])
            ->orderByDesc('created_at')
            ->get()
            ->map(function (Review $review): array {
                $payload = ProductMapper::reviewToArray($review);
                $payload['status'] = $review->is_approved ? 'published' : 'pending';
                $payload['orderId'] = $review->orderItem?->order?->order_reference
                    ?? $review->orderItem?->order?->rid;

                if ($review->product) {
                    $payload['product'] = ProductMapper::toListItem($review->product);
                }

                return $payload;
            })
            ->values()
            ->all();

        return response()->json(['items' => $reviews]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'reviewId' => ['required', 'string'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'title' => ['nullable', 'string', 'max:160'],
            'detailedReview' => ['nullable', 'string', 'max:5000'],
        ]);

        $orderItem = OrderItem::query()
            ->where('rid', $data['reviewId'])
            ->whereDoesntHave('review')
            ->whereHas('order', fn ($query) => $this->boughtBy($query, $user->id))
            ->with(['order', 'product'])
            ->first();

        if (! $orderItem) {
            return api_error('waiting_review_not_found', 'Waiting review item not found.', 404);
        }

        if (! $orderItem->product_id) {
            return api_error('product_missing', 'Order item has no product to review.', 422);
        }

        try {
            $review = Review::query()->create([
                'product_id' => $orderItem->product_id,
                'user_id' => $user->id,
                'order_item_id' => $orderItem->id,
                'rating' => $data['rating'],
                'title' => $data['title'] ?? null,
                'body' => $data['detailedReview'] ?? null,
                'author_display' => $user->display_name ?: explode(' ', $user->name)[0],
                // Published once staff approve it in the admin Reviews page.
                'is_approved' => false,
            ]);
        } catch (UniqueConstraintViolationException) {
            return api_error('review_exists', 'You already reviewed this item.', 409);
        }

        $payload = ProductMapper::reviewToArray($review->load('product.category.parent', 'product.tags', 'product.attributeValues.definition', 'product.defaultVariant'));
        $payload['status'] = 'pending';
        if ($review->product) {
            $payload['product'] = ProductMapper::toListItem($review->product);
        }

        return response()->json($payload, 201);
    }

    /**
     * Orders whose items the shopper may review: theirs, paid for, and not
     * cancelled. Bought is enough; staff do not have to mark the order
     * delivered first. Refunded orders are excluded by the payment status.
     */
    private function boughtBy(Builder $orders, int $userId): Builder
    {
        return $orders->where('user_id', $userId)
            ->where('payment_status', OrderPaymentStatus::Paid)
            ->where('status', '!=', OrderStatus::Cancelled);
    }
}
