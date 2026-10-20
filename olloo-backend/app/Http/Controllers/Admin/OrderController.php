<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\OrderPaymentStatus;
use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Jobs\NotifyCustomerOrderShipped;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Services\OrderService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function __construct(
        private readonly OrderService $orders,
    ) {}

    public function index(Request $request): Response
    {
        abort_unless($request->user('staff')->can('view_orders'), 403);

        $status = $request->string('status')->toString();

        $orders = Order::query()
            ->with('user:id,rid,name,email')
            ->when(
                $status !== '' && in_array($status, OrderStatus::values(), true),
                fn ($query) => $query->where('status', $status)
            )
            ->latest('placed_at')
            ->latest('id')
            ->paginate((int) config('admin.per_page'))
            ->withQueryString()
            ->through(fn (Order $order) => [
                'rid' => $order->rid,
                'orderReference' => $order->order_reference,
                'status' => $order->status,
                'paymentStatus' => $order->payment_status,
                'total' => money($order->total_minor, $order->currency_code)['amount'],
                'currencyCode' => $order->currency_code,
                'customerName' => $order->user?->name,
                'customerEmail' => $order->user?->email,
                'placedAt' => $order->placed_at?->toIso8601String(),
            ]);

        return Inertia::render('Admin/Orders/Index', [
            'orders' => $orders,
            'filters' => [
                'status' => in_array($status, OrderStatus::values(), true) ? $status : '',
            ],
            'statuses' => OrderStatus::values(),
        ]);
    }

    public function show(Request $request, Order $order): Response
    {
        abort_unless($request->user('staff')->can('view_orders'), 403);

        $order->load([
            'user:id,rid,name,email',
            'items',
            'payments',
            'taxLines',
        ]);

        $amount = fn (int $minor): float|int => money($minor, $order->currency_code)['amount'];

        return Inertia::render('Admin/Orders/Show', [
            'order' => [
                'rid' => $order->rid,
                'orderReference' => $order->order_reference,
                'status' => $order->status,
                'paymentStatus' => $order->payment_status,
                'paymentMethod' => $order->payment_method,
                'currencyCode' => $order->currency_code,
                'itemsTotal' => $amount($order->items_total_minor),
                'itemsDiscount' => $amount($order->items_discount_minor),
                'shipping' => $amount($order->shipping_minor),
                'tax' => $amount($order->tax_minor),
                'taxLines' => $order->taxLines->map(fn ($line) => [
                    'name' => $line->name,
                    'ratePercent' => $line->rate_bp / 100,
                    'amount' => $amount($line->amount_minor),
                ])->values()->all(),
                'total' => $amount($order->total_minor),
                // Charged in the shopper's currency: what it is worth in the
                // base currency at the market rate, and the rates used.
                'baseCurrencyCode' => $order->base_currency_code,
                'baseTotal' => $order->base_total_minor !== null && $order->base_currency_code !== null
                    ? money($order->base_total_minor, $order->base_currency_code)['amount']
                    : null,
                'fxRates' => $order->fx_snapshot['rates'] ?? [],
                'estimatedDelivery' => $order->estimated_delivery,
                'addressSnapshot' => $order->address_snapshot,
                'placedAt' => $order->placed_at?->toIso8601String(),
                'customer' => $order->user === null ? null : [
                    'rid' => $order->user->rid,
                    'name' => $order->user->name,
                    'email' => $order->user->email,
                ],
                'items' => $order->items->map(fn (OrderItem $item) => [
                    'rid' => $item->rid,
                    'productRid' => $item->product_rid,
                    'productName' => $item->product_name,
                    'variantName' => $item->variant_name,
                    'sku' => $item->sku,
                    'image' => $item->image,
                    'imageUrl' => $item->image_url,
                    'unitPrice' => $amount($item->unit_price_minor),
                    'sourceCurrencyCode' => $item->source_currency_code,
                    'sourceUnitPrice' => $item->source_unit_price_minor !== null && $item->source_currency_code !== null
                        ? money($item->source_unit_price_minor, $item->source_currency_code)['amount']
                        : null,
                    'quantity' => $item->quantity,
                ])->values()->all(),
                'payments' => $order->payments->map(fn (Payment $payment) => [
                    'rid' => $payment->rid,
                    'provider' => $payment->provider,
                    'status' => $payment->status,
                    'amount' => money($payment->amount_minor, $payment->currency_code)['amount'],
                    'currencyCode' => $payment->currency_code,
                    'externalReference' => $payment->external_reference,
                ])->values()->all(),
            ],
            'statuses' => OrderStatus::values(),
            'canEdit' => $request->user('staff')->can('edit_orders'),
        ]);
    }

    public function updateStatus(Request $request, Order $order): RedirectResponse
    {
        abort_unless($request->user('staff')->can('edit_orders'), 403);

        $validated = $request->validate([
            'status' => ['required', 'string', Rule::in(OrderStatus::values())],
        ]);

        $previous = $order->status;
        $next = OrderStatus::from($validated['status']);

        if ($next === $previous) {
            return redirect()->route('admin.orders.show', $order);
        }

        if ($previous === OrderStatus::Cancelled) {
            throw ValidationException::withMessages([
                'status' => 'This order is cancelled and its stock was released. Ask the customer to place a new order.',
            ]);
        }

        if ($next->requiresPayment() && $order->payment_status !== OrderPaymentStatus::Paid) {
            throw ValidationException::withMessages([
                'status' => "This order is {$order->payment_status->label()}. Only paid orders can be marked {$next->label()}.",
            ]);
        }

        if ($next === OrderStatus::PendingPayment && $order->payment_status === OrderPaymentStatus::Paid) {
            throw ValidationException::withMessages([
                'status' => 'This order is already paid, so it cannot go back to awaiting payment.',
            ]);
        }

        if ($next === OrderStatus::Cancelled) {
            $this->orders->cancel($order, 'Your order was cancelled by our team.');

            return redirect()->route('admin.orders.show', $order)
                ->with('success', $order->payment_status === OrderPaymentStatus::Paid
                    ? 'Order cancelled and stock released. It was paid, so refund the customer from the payment provider.'
                    : 'Order cancelled and stock released.');
        }

        $order->update([
            'status' => $next,
            'shipped_at' => in_array($next, [OrderStatus::Shipped, OrderStatus::Delivered], true) ? ($order->shipped_at ?? now()) : $order->shipped_at,
            'delivered_at' => $next === OrderStatus::Delivered ? ($order->delivered_at ?? now()) : $order->delivered_at,
        ]);

        if ($next === OrderStatus::Shipped) {
            $order->trackingEvents()->create([
                'label' => 'Order shipped',
                'description' => 'Your package is on the way.',
                'occurred_at' => now(),
            ]);

            NotifyCustomerOrderShipped::dispatch($order->id);
        }

        return redirect()->route('admin.orders.show', $order)
            ->with('success', 'Order status updated.');
    }
}
