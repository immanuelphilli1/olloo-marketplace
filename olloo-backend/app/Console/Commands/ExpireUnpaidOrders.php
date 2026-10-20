<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Enums\OrderPaymentStatus;
use App\Enums\OrderStatus;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Console\Command;

/**
 * Cancels orders still awaiting payment after the payment window, counting
 * from the latest payment attempt, so their held stock goes back on sale.
 * A payment that settles after this is flagged for staff review.
 */
final class ExpireUnpaidOrders extends Command
{
    protected $signature = 'orders:expire-unpaid';

    protected $description = 'Cancel orders awaiting payment past the payment window and release their stock';

    public function handle(OrderService $orders): int
    {
        $cutoff = now()->subMinutes((int) config('payments.order_payment_window_minutes'));
        $expired = 0;

        Order::query()
            ->where('status', OrderStatus::PendingPayment)
            ->whereIn('payment_status', [OrderPaymentStatus::Unpaid, OrderPaymentStatus::Failed])
            ->where('placed_at', '<', $cutoff)
            ->whereDoesntHave('payments', fn ($payments) => $payments->where('created_at', '>=', $cutoff))
            ->orderBy('id')
            ->each(function (Order $order) use ($orders, &$expired): void {
                $orders->cancel($order, 'Payment was not completed in time, so the order was cancelled.');
                $expired++;
            });

        $this->info("Cancelled {$expired} unpaid order(s).");

        return self::SUCCESS;
    }
}
