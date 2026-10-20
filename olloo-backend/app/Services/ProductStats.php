<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\OrderPaymentStatus;
use App\Enums\OrderStatus;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Review;

/**
 * Rating, review count and sold count shown on the storefront are derived
 * from data, never typed: approved reviews and paid, not cancelled orders.
 */
final class ProductStats
{
    public function refreshReviews(int $productId): void
    {
        $approved = Review::query()->where('product_id', $productId)->where('is_approved', true);

        Product::query()->whereKey($productId)->update([
            'rating' => round((float) ((clone $approved)->avg('rating') ?? 0), 2),
            'review_count' => (clone $approved)->count(),
        ]);
    }

    public function refreshSold(int $productId): void
    {
        $sold = OrderItem::query()
            ->where('product_id', $productId)
            ->whereHas('order', fn ($orders) => $orders
                ->where('payment_status', OrderPaymentStatus::Paid)
                ->where('status', '!=', OrderStatus::Cancelled))
            ->sum('quantity');

        Product::query()->whereKey($productId)->update(['sold_count' => (int) $sold]);
    }

    public function refreshAll(): int
    {
        $count = 0;
        Product::query()->orderBy('id')->pluck('id')->each(function (int $id) use (&$count): void {
            $this->refreshReviews($id);
            $this->refreshSold($id);
            $count++;
        });

        return $count;
    }
}
