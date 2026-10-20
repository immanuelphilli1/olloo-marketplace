<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Order;
use App\Models\ProductVariant;
use Illuminate\Support\Facades\DB;

/**
 * Stock is taken when an order is placed (awaiting payment) and handed back
 * when that order is cancelled, so two shoppers cannot buy the last unit.
 * Variants with NULL stock_quantity are not tracked and never block a sale.
 */
final class InventoryService
{
    /**
     * Lock the variants, check every quantity, then decrement tracked stock.
     * Must run inside the caller's transaction.
     *
     * @param  array<int, int>  $quantities  variant id => quantity
     * @return list<array{variantRid: string, requested: int, available: int}> shortfalls; empty when reserved
     */
    public function reserve(array $quantities): array
    {
        ksort($quantities); // consistent lock order avoids deadlocks between checkouts

        $variants = ProductVariant::query()
            ->whereIn('id', array_keys($quantities))
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');

        $shortfalls = [];
        foreach ($quantities as $variantId => $quantity) {
            $variant = $variants->get($variantId);
            if ($variant instanceof ProductVariant && ! $variant->hasStockFor($quantity)) {
                $shortfalls[] = [
                    'variantRid' => $variant->rid,
                    'requested' => $quantity,
                    'available' => (int) $variant->stock_quantity,
                ];
            }
        }

        if ($shortfalls !== []) {
            return $shortfalls;
        }

        foreach ($quantities as $variantId => $quantity) {
            ProductVariant::query()
                ->whereKey($variantId)
                ->whereNotNull('stock_quantity')
                ->decrement('stock_quantity', $quantity);
        }

        return [];
    }

    /** Return an order's held stock. Call only when the order stops holding it. */
    public function release(Order $order): void
    {
        DB::transaction(function () use ($order): void {
            foreach ($order->items()->whereNotNull('product_variant_id')->get() as $item) {
                ProductVariant::query()
                    ->whereKey($item->product_variant_id)
                    ->whereNotNull('stock_quantity')
                    ->increment('stock_quantity', (int) $item->quantity);
            }
        });
    }
}
