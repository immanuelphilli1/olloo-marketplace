<?php

declare(strict_types=1);

namespace App\Services;

use App\Currency\CurrencyConverter;
use App\Currency\ExchangeRate;
use App\Enums\OrderPaymentStatus;
use App\Enums\OrderStatus;
use App\Models\Address;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Currency;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturn;
use App\Models\OrderTaxLine;
use App\Models\OrderTrackingEvent;
use App\Models\Product;
use App\Models\User;
use App\Shipping\DeliveryDestination;
use App\Support\ProductMapper;
use App\Tax\TaxCalculator;
use App\Tax\TaxLine;
use Carbon\CarbonInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class OrderService
{
    public function __construct(
        private readonly CartService $carts,
        private readonly ShippingService $shipping,
        private readonly InventoryService $inventory,
        private readonly TaxCalculator $taxes,
        private readonly CurrencyConverter $fx,
    ) {}

    /**
     * @param  iterable<CartItem>  $items
     * @return list<TaxLine>
     */
    private function taxLinesFor(iterable $items, string $currency): array
    {
        $lines = [];
        foreach ($items as $item) {
            $lines[] = new TaxLine($item->rid, $item->unitPriceMinorIn($currency) * (int) $item->quantity, $item->product->tax_class_id);
        }

        return $lines;
    }

    /**
     * Create an order awaiting payment from the chosen cart lines. Totals are
     * frozen here at today's prices and exchange rates, in the cart's
     * (shopper's) currency, and stock is held; the customer then pays exactly
     * `total_minor` through POST /checkout/payment-intent. The rates used and
     * the total valued in the base currency are kept in the FX snapshot.
     *
     * @param  list<string>  $cartItemRids
     */
    public function placeOrder(User $user, Cart $cart, string $addressRid, array $cartItemRids): Order
    {
        if ($cartItemRids === []) {
            abort(api_error('cart_items_required', 'Select at least one cart item to order.', 422));
        }

        $address = Address::query()
            ->where('user_id', $user->id)
            ->where('rid', $addressRid)
            ->with('country')
            ->first();

        if (! $address) {
            abort(api_error('address_not_found', 'Address not found.', 404));
        }

        $this->assertLinesOrderable($cart, $cartItemRids);

        return DB::transaction(function () use ($user, $cart, $address, $cartItemRids): Order {
            $items = $cart->items()
                ->whereIn('rid', $cartItemRids)
                ->with(['product', 'productVariant'])
                ->lockForUpdate()
                ->get();

            // Prices could move between the check above and taking the lock.
            if ($items->count() !== count(array_unique($cartItemRids)) || $items->contains(fn (CartItem $item) => $item->priceChanged())) {
                abort(api_error('cart_changed', 'Your cart changed while placing the order. Review it and try again.', 409));
            }

            $quantities = [];
            foreach ($items as $item) {
                $quantities[$item->product_variant_id] = ($quantities[$item->product_variant_id] ?? 0) + (int) $item->quantity;
            }

            $shortfalls = $this->inventory->reserve($quantities);
            if ($shortfalls !== []) {
                abort(api_error('insufficient_stock', 'Some items no longer have enough stock. Update the quantities and try again.', 409, [
                    'items' => $shortfalls,
                ]));
            }

            $currency = (string) $cart->currency_code;
            $baseCurrency = Currency::defaultCode();
            $this->fx->trackUsage();
            $itemsTotalMinor = 0;
            $subtotalMinor = 0;

            foreach ($items as $item) {
                $unitMinor = $item->unitPriceMinorIn($currency);
                $qty = (int) $item->quantity;
                $lineSubtotal = $unitMinor * $qty;
                $subtotalMinor += $lineSubtotal;

                $originalUnit = $this->carts->originalUnitMinor($item, $currency);
                $itemsTotalMinor += ($originalUnit !== null && $originalUnit > $unitMinor)
                    ? ($originalUnit * $qty)
                    : $lineSubtotal;
            }

            // Quote shipping for exactly the lines being ordered, to this address.
            $quote = $this->shipping->quoteLines($currency, $address->country->code, $this->shipping->linesFor($items, $currency));
            $shippingMinor = (int) $quote['feeMinor'];

            // Prices are tax-exclusive; tax is added for the destination.
            $tax = $this->taxes->calculate($address->country->code, $this->taxLinesFor($items, $currency), $shippingMinor);
            $totalMinor = $subtotalMinor + $shippingMinor + $tax['totalMinor'];
            // Valued at the mid rate: what the order is worth to us before markup.
            $baseTotalMinor = $this->fx->valueAtMidRate($totalMinor, $currency, $baseCurrency);

            $order = Order::query()->create([
                'order_reference' => generate_order_reference(),
                'user_id' => $user->id,
                'address_id' => $address->id,
                'status' => OrderStatus::PendingPayment,
                'payment_status' => OrderPaymentStatus::Unpaid,
                'payment_method' => null,
                'currency_code' => $currency,
                'base_currency_code' => $baseCurrency,
                'items_total_minor' => $itemsTotalMinor,
                'items_discount_minor' => max(0, $itemsTotalMinor - $subtotalMinor),
                'shipping_minor' => $shippingMinor,
                'tax_minor' => $tax['totalMinor'],
                'total_minor' => $totalMinor,
                'base_total_minor' => $baseTotalMinor,
                'estimated_delivery' => $quote['estimatedDelivery'],
                'shipping_snapshot' => [
                    'feeMinor' => $shippingMinor,
                    'deliveryDays' => $quote['deliveryDays'],
                    'courierLabel' => $quote['courierLabel'],
                ],
                'fx_snapshot' => [
                    'baseCurrency' => $baseCurrency,
                    'rates' => array_map(fn (ExchangeRate $rate): array => $rate->toArray(), $this->fx->usedRates()),
                ],
                'address_snapshot' => $this->addressSnapshot($address),
                'placed_at' => now(),
            ]);

            foreach ($items as $item) {
                $order->items()->create([
                    'product_id' => $item->product_id,
                    'product_variant_id' => $item->product_variant_id,
                    'product_rid' => $item->product->rid,
                    'product_name' => $item->product->name,
                    'variant_name' => $item->productVariant->name,
                    'sku' => $item->productVariant->sku,
                    'image' => $item->product->image,
                    'unit_price_minor' => $item->unitPriceMinorIn($currency),
                    'source_currency_code' => $item->product->currency_code,
                    'source_unit_price_minor' => $item->currentUnitPriceMinor(),
                    'tax_minor' => $tax['perLine'][$item->rid] ?? 0,
                    'quantity' => (int) $item->quantity,
                ]);
            }

            foreach ($tax['components'] as $component) {
                $order->taxLines()->create([
                    'name' => $component['name'],
                    'country' => $component['country'],
                    'rate_bp' => $component['rateBp'],
                    'is_compound' => $component['isCompound'],
                    'taxable_minor' => $component['taxableMinor'],
                    'amount_minor' => $component['amountMinor'],
                ]);
            }

            $cart->items()->whereIn('rid', $cartItemRids)->delete();

            $order->trackingEvents()->create([
                'label' => 'Order placed',
                'description' => 'We received your order. It is confirmed once payment goes through.',
                'occurred_at' => now(),
            ]);

            return $order->fresh(['items', 'trackingEvents']);
        });
    }

    /**
     * Cancel an order and hand back any stock it still holds.
     */
    public function cancel(Order $order, string $reason): void
    {
        $releasesStock = $order->status->holdsStock();

        DB::transaction(function () use ($order, $reason): void {
            $order->update(['status' => OrderStatus::Cancelled]);
            $order->trackingEvents()->create([
                'label' => 'Order cancelled',
                'description' => $reason,
                'occurred_at' => now(),
            ]);
        });

        if ($releasesStock) {
            $this->inventory->release($order);
        }
    }

    /**
     * @return array{orderId: string, orderReference: string, estimatedDelivery: string, status: string, paymentStatus: string, total: array{amount: float|int, currency: string}}
     */
    public function placedResponse(Order $order): array
    {
        return [
            'orderId' => $order->rid,
            'orderReference' => $order->order_reference,
            'estimatedDelivery' => (string) $order->estimated_delivery,
            'status' => $order->status->value,
            'paymentStatus' => $order->payment_status->value,
            'totalMoney' => money((int) $order->total_minor, $order->currency_code),
        ];
    }

    /**
     * Refuse to order lines that changed since the shopper last saw them.
     * Price changes are acknowledged first, so the next attempt succeeds once
     * the client has shown the new prices.
     *
     * @param  list<string>  $cartItemRids
     */
    private function assertLinesOrderable(Cart $cart, array $cartItemRids): void
    {
        $items = $cart->items()
            ->whereIn('rid', $cartItemRids)
            ->with(['product', 'productVariant'])
            ->get();

        if ($items->count() !== count(array_unique($cartItemRids))) {
            abort(api_error('cart_item_not_found', 'One or more cart items were not found.', 404));
        }

        $unavailable = $items->reject(fn (CartItem $item): bool => $item->isPurchasable());
        if ($unavailable->isNotEmpty()) {
            abort(api_error('item_unavailable', 'Some items are no longer available. Remove them to continue.', 409, [
                'cartItemIds' => $unavailable->pluck('rid')->values()->all(),
            ]));
        }

        $changed = $items->filter(fn (CartItem $item): bool => $item->priceChanged())->values();
        if ($changed->isNotEmpty()) {
            $details = $changed->map(fn (CartItem $item): array => [
                'cartItemId' => $item->rid,
                'previousPrice' => $this->carts->previousPrice($item, $cart->currency_code),
                'price' => money($item->unitPriceMinorIn($cart->currency_code), $cart->currency_code),
            ])->all();

            $this->carts->acknowledgePrices($changed);

            abort(api_error(
                'price_changed',
                'Some prices changed since you added these items. Review the new prices and place the order again.',
                409,
                ['items' => $details],
            ));
        }
    }

    /**
     * @return array{orders: list<array<string, mixed>>, total: int}
     */
    public function listForUser(User $user, Request $request): array
    {
        $status = (string) $request->query('status', 'all');
        $search = trim((string) $request->query('search', ''));
        $page = max(1, (int) $request->query('page', 1));
        $limit = min(50, max(1, (int) $request->query('limit', 15)));

        $query = Order::query()
            ->where('user_id', $user->id)
            ->with(['items'])
            ->orderByDesc('placed_at')
            ->orderByDesc('id');

        if ($status === 'returns') {
            $query->whereHas('returns');
        } elseif ($status !== 'all' && $status !== '') {
            if (OrderStatus::tryFrom($status) === null) {
                abort(api_error('invalid_status', 'Invalid order status filter. Use all, returns, or one of: '.implode(', ', OrderStatus::values()).'.', 422));
            }
            $query->where('status', $status);
        }

        if ($search !== '') {
            $query->where(function ($q) use ($search): void {
                $q->where('rid', 'like', '%'.$search.'%')
                    ->orWhere('order_reference', 'like', '%'.$search.'%');
            });
        }

        /** @var LengthAwarePaginator<int, Order> $paginator */
        $paginator = $query->paginate($limit, ['*'], 'page', $page);

        return [
            'orders' => collect($paginator->items())
                ->map(fn (Order $order): array => $this->toListItem($order))
                ->values()
                ->all(),
            'total' => $paginator->total(),
        ];
    }

    public function findForUser(User $user, string $orderRid): Order
    {
        $order = Order::query()
            ->where('user_id', $user->id)
            ->where('rid', $orderRid)
            ->with(['items', 'trackingEvents', 'returns', 'address'])
            ->first();

        if (! $order) {
            abort(api_error('order_not_found', 'Order not found.', 404));
        }

        return $order;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function buyAgainProducts(User $user, int $limit = 12): array
    {
        $limit = min(50, max(1, $limit));

        $productIds = OrderItem::query()
            ->whereHas('order', fn ($q) => $q->where('user_id', $user->id))
            ->whereNotNull('product_id')
            ->orderByDesc('id')
            ->limit(100)
            ->pluck('product_id')
            ->unique()
            ->take($limit)
            ->values();

        if ($productIds->isEmpty()) {
            return [];
        }

        $products = Product::query()
            ->whereIn('id', $productIds)
            ->where('is_active', true)
            ->with(['category.parent', 'tags', 'attributeValues.definition', 'defaultVariant'])
            ->get()
            ->keyBy('id');

        $wishlistIds = $user->wishlists()->pluck('product_id')->flip();
        app(DestinationPricing::class)->attach($products, DeliveryDestination::forUser($user));

        return $productIds
            ->map(function ($id) use ($products, $wishlistIds): ?array {
                $product = $products->get($id);
                if (! $product instanceof Product) {
                    return null;
                }

                return ProductMapper::toListItem($product, $wishlistIds->has($id));
            })
            ->filter()
            ->values()
            ->all();
    }

    public function buyAgainFromOrder(User $user, Order $order, Cart $cart): Cart
    {
        $order->loadMissing(['items.productVariant']);

        foreach ($order->items as $item) {
            if (! is_string($item->product_rid) || $item->product_rid === '') {
                continue;
            }

            // Same variant as before when it still exists, else the product default.
            $cart = $this->carts->addItem(
                $cart,
                $item->product_rid,
                $item->productVariant?->rid,
                max(1, (int) $item->quantity),
            );
        }

        return $cart->fresh();
    }

    /**
     * A shopper cancelling their own order.
     *
     * Only while the order is still awaiting payment. Nothing has been charged
     * yet, so cancelling is just releasing the stock that was held for it, and
     * there is no money to return. Once an order is paid, cancelling means
     * refunding, and there is no refund on the gateway port yet: staff do that
     * by hand. After dispatch the parcel has left, which is a return rather than
     * a cancellation, so that path points at requestReturn().
     */
    public function cancelByCustomer(User $user, Order $order, ?string $reason): Order
    {
        // Ownership is checked here as well as by the caller's lookup. Cancelling
        // someone else's order releases their stock and destroys their order, so
        // it must not rest on the caller having scoped the query correctly.
        if ($order->user_id !== $user->id) {
            abort(api_error('order_not_found', 'Order not found.', 404));
        }

        // Cancelling an already cancelled order is the outcome the caller
        // asked for, so answer with it rather than an error: a client retrying
        // after a timeout should not be told the request failed.
        if ($order->status === OrderStatus::Cancelled) {
            return $order;
        }

        if ($order->status !== OrderStatus::PendingPayment) {
            abort(api_error(
                'order_not_cancellable',
                $order->status === OrderStatus::Processing
                    ? 'This order is paid and being prepared, so it cannot be cancelled here. Contact us and we will sort it out.'
                    : "This order is {$order->status->label()}, so it can no longer be cancelled.",
                409,
                ['status' => $order->status->value],
            ));
        }

        // A payment can be created before it settles, so an order can still be
        // awaiting payment with a charge in flight. PaymentSettlementService
        // already flags a charge that lands after this as needs_review rather
        // than settling an order the shopper has walked away from.
        if ($order->payment_status !== OrderPaymentStatus::Unpaid
            && $order->payment_status !== OrderPaymentStatus::Failed) {
            abort(api_error(
                'order_not_cancellable',
                "This order is {$order->payment_status->label()}, so it cannot be cancelled.",
                409,
                ['status' => $order->status->value, 'paymentStatus' => $order->payment_status->value],
            ));
        }

        $this->cancel($order, $reason !== null && trim($reason) !== ''
            ? 'Cancelled at the customer\'s request: '.trim($reason)
            : 'Cancelled at the customer\'s request.');

        return $order->fresh();
    }

    public function requestReturn(User $user, Order $order, ?string $reason): OrderReturn
    {
        if (! in_array($order->status, [OrderStatus::Delivered, OrderStatus::Shipped], true)) {
            abort(api_error('return_not_allowed', 'Returns are only available after shipping or delivery.', 422));
        }

        $eligibility = $this->returnEligibility($order);
        if (! $eligibility['eligible']) {
            abort(api_error('return_not_allowed', $eligibility['reason'] ?? 'This order cannot be returned.', 422, [
                'eligibility' => $eligibility,
            ]));
        }

        $existing = $order->returns()
            ->where('user_id', $user->id)
            ->whereIn('status', ['requested', 'approved', 'processing'])
            ->first();

        if ($existing) {
            abort(api_error('return_already_open', 'A return request is already open for this order.', 422));
        }

        return $order->returns()->create([
            'user_id' => $user->id,
            'status' => 'requested',
            'reason' => $reason,
        ]);
    }

    /**
     * Return eligibility for an order, from its items' categories. A category
     * marked non-returnable (itself or an ancestor) blocks the order, and the
     * tightest return window across the items sets the deadline from the real
     * delivered date (falling back to shipped, then placed).
     *
     * @return array{eligible: bool, reason: string|null, windowDays: int|null, deadline: string|null}
     */
    public function returnEligibility(Order $order): array
    {
        $order->loadMissing(['items.product.category.parent']);

        $windowDays = null;
        foreach ($order->items as $item) {
            $category = $item->product?->category;
            if (! $category) {
                continue;
            }

            $chain = [$category];
            $parent = $category->parent;
            $depth = 0;
            while ($parent && $depth < 20) {
                $chain[] = $parent;
                $parent = $parent->parent;
                $depth++;
            }

            foreach ($chain as $node) {
                if (! $node->is_returnable) {
                    return [
                        'eligible' => false,
                        'reason' => "\"{$category->label}\" items cannot be returned.",
                        'windowDays' => null,
                        'deadline' => null,
                    ];
                }
                if ($node->return_window_days !== null) {
                    $windowDays = $windowDays === null
                        ? (int) $node->return_window_days
                        : min($windowDays, (int) $node->return_window_days);
                    break;
                }
            }
        }

        if ($windowDays === null) {
            return ['eligible' => true, 'reason' => null, 'windowDays' => null, 'deadline' => null];
        }

        $deliveredAt = $order->delivered_at ?? $order->shipped_at ?? $order->placed_at ?? $order->created_at;
        if (! $deliveredAt) {
            return ['eligible' => true, 'reason' => null, 'windowDays' => $windowDays, 'deadline' => null];
        }

        $deadline = $deliveredAt->copy()->addDays($windowDays);
        if (now()->greaterThan($deadline)) {
            return [
                'eligible' => false,
                'reason' => "The {$windowDays}-day return window ended on {$deadline->format('M j, Y')}.",
                'windowDays' => $windowDays,
                'deadline' => $deadline->toIso8601String(),
            ];
        }

        return [
            'eligible' => true,
            'reason' => null,
            'windowDays' => $windowDays,
            'deadline' => $deadline->toIso8601String(),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function tracking(Order $order): array
    {
        $order->loadMissing('trackingEvents');

        return $order->trackingEvents
            ->sortBy('occurred_at')
            ->values()
            ->map(fn (OrderTrackingEvent $event): array => [
                'rid' => $event->rid,
                'label' => $event->label,
                'description' => $event->description,
                'occurredAt' => optional($event->occurred_at)?->toIso8601String(),
            ])
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function toListItem(Order $order): array
    {
        $order->loadMissing('items');
        $placedAt = $order->placed_at ?? $order->created_at;

        return [
            'rid' => $order->rid,
            'status' => $order->status->value,
            'paymentStatus' => $order->payment_status->value,
            'statusDate' => $this->statusDate($order)?->toIso8601String(),
            'placedAt' => optional($placedAt)?->toIso8601String(),
            'itemCount' => (int) $order->items->sum('quantity'),
            'totalMoney' => money((int) $order->total_minor, $order->currency_code),
            'productImages' => $order->items
                ->pluck('image')
                ->filter()
                ->unique()
                ->values()
                ->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function toDetail(Order $order): array
    {
        $order->loadMissing(['items.review', 'address', 'returns', 'taxLines']);

        return [
            ...$this->toListItem($order),
            'orderId' => $order->rid,
            'orderReference' => $order->order_reference,
            'estimatedDelivery' => $order->estimated_delivery,
            'paymentMethod' => $order->payment_method,
            'currency' => $order->currency_code,
            'items' => $order->items->map(fn (OrderItem $item): array => [
                'rid' => $item->rid,
                'productRid' => $item->product_rid,
                'name' => $item->product_name,
                'variant' => $item->variant_name,
                'image' => $item->image,
                'imageUrl' => $item->image_url,
                'quantity' => (int) $item->quantity,
                'unitPrice' => money((int) $item->unit_price_minor, $order->currency_code),
                'sku' => $item->sku,
                'reviewed' => $item->review !== null,
            ])->values()->all(),
            'totals' => [
                'itemsTotal' => money((int) $order->items_total_minor, $order->currency_code),
                'itemsDiscount' => money((int) $order->items_discount_minor, $order->currency_code),
                'shipping' => money((int) $order->shipping_minor, $order->currency_code),
                'tax' => money((int) $order->tax_minor, $order->currency_code),
                'total' => money((int) $order->total_minor, $order->currency_code),
            ],
            'taxes' => $order->taxLines->map(fn (OrderTaxLine $line): array => [
                'name' => $line->name,
                'ratePercent' => $line->rate_bp / 100,
                'taxable' => money($line->taxable_minor, $order->currency_code),
                'amount' => money($line->amount_minor, $order->currency_code),
            ])->values()->all(),
            'address' => $order->address_snapshot,
            'shipping' => $order->shipping_snapshot,
            'returnEligibility' => $this->returnEligibility($order),
            'returns' => $order->returns->map(fn (OrderReturn $ret): array => [
                'rid' => $ret->rid,
                'status' => $ret->status,
                'reason' => $ret->reason,
            ])->values()->all(),
            'tracking' => $this->tracking($order),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function addressSnapshot(Address $address): array
    {
        return [
            'rid' => $address->rid,
            'country' => $address->country->name,
            'countryCode' => $address->country->code,
            'firstName' => $address->first_name,
            'lastName' => $address->last_name,
            'phoneCountryCode' => $address->phone_country_code,
            'phoneNumber' => $address->phone_number,
            'addressLine' => $address->address_line,
            'region' => $address->region,
            'city' => $address->city,
            'cityLine' => $address->city_line,
            'contact' => trim($address->first_name.' '.$address->last_name)
                .' | '.$address->phone_country_code.' '.$address->phone_number,
            'line1' => $address->address_line,
            'line2' => trim(implode(' ', array_filter([
                $address->city,
                $address->region,
                $address->country->name,
            ]))),
        ];
    }

    private function statusDate(Order $order): ?CarbonInterface
    {
        return match ($order->status) {
            OrderStatus::Delivered => $order->delivered_at ?? $order->placed_at ?? $order->created_at,
            OrderStatus::Shipped => $order->shipped_at ?? $order->placed_at ?? $order->created_at,
            default => $order->placed_at ?? $order->created_at,
        };
    }
}
