<?php

declare(strict_types=1);

namespace App\Services;

use App\Currency\CurrencyConverter;
use App\Currency\ShopperLocale;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Models\Wishlist;
use App\Shipping\DeliveryDestination;
use App\Tax\TaxCalculator;
use App\Tax\TaxLine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class CartService
{
    public function __construct(
        private readonly ShippingService $shipping,
        private readonly TaxCalculator $taxes,
        private readonly CurrencyConverter $fx,
        private readonly ShopperLocale $locale,
    ) {}

    /**
     * The request's cart, priced in the shopper's currency. Lines keep their
     * product-currency prices, so following the shopper (travel, ?country=)
     * just reprices the cart at today's rate.
     */
    public function resolveCart(Request $request): Cart
    {
        $cart = $this->findOrCreateCart($request);

        if ($cart->currency_code !== $this->locale->currency()) {
            $cart->update(['currency_code' => $this->locale->currency()]);
        }

        return $cart;
    }

    private function findOrCreateCart(Request $request): Cart
    {
        $user = $request->user();

        if ($user instanceof User) {
            return $this->getOrCreateUserCart($user);
        }

        $cartRid = $request->header('X-Cart-Id') ?: $request->cookie('cart_id');

        if (is_string($cartRid) && $cartRid !== '') {
            $cart = Cart::query()
                ->where('rid', $cartRid)
                ->whereNull('user_id')
                ->first();

            if ($cart) {
                return $cart;
            }
        }

        return Cart::query()->create([
            'user_id' => null,
            'currency_code' => $this->locale->currency(),
        ]);
    }

    public function getOrCreateUserCart(User $user): Cart
    {
        $cart = $user->cart()->first();

        if ($cart) {
            return $cart;
        }

        return $user->cart()->create([
            'currency_code' => $this->locale->currency(),
        ]);
    }

    public function addItem(Cart $cart, string $productRid, ?string $variantRid, int $quantity): Cart
    {
        if ($quantity < 1) {
            abort(api_error('invalid_quantity', 'Quantity must be at least 1.', 422));
        }

        $product = Product::query()
            ->where('rid', $productRid)
            ->where('is_active', true)
            ->first();

        if (! $product) {
            abort(api_error('product_not_found', 'Product not found.', 404));
        }

        // Refuse up front rather than hold a line the cart cannot price.
        $this->fx->rate($product->currency_code, $cart->currency_code);

        // An absent variantId means the shopper made no choice: use the default.
        $variant = ($variantRid !== null && $variantRid !== '')
            ? ProductVariant::query()->where('rid', $variantRid)->where('product_id', $product->id)->first()
            : $product->defaultVariant()->first();

        if (! $variant instanceof ProductVariant) {
            abort(api_error('variant_not_found', 'Product variant not found.', 404));
        }

        $variant->setRelation('product', $product);
        $unitPriceMinor = $variant->unitPriceMinor();

        return DB::transaction(function () use ($cart, $product, $variant, $quantity, $unitPriceMinor): Cart {
            /** @var CartItem|null $item */
            $item = $cart->items()->where('product_variant_id', $variant->id)->lockForUpdate()->first();
            $nextQuantity = ($item?->quantity ?? 0) + $quantity;

            $this->assertStock($variant, $nextQuantity);

            if ($item instanceof CartItem) {
                $item->update([
                    'quantity' => $nextQuantity,
                    'unit_price_minor' => $unitPriceMinor,
                    'selected' => true,
                ]);
            } else {
                $cart->items()->create([
                    'product_id' => $product->id,
                    'product_variant_id' => $variant->id,
                    'quantity' => $quantity,
                    'selected' => true,
                    'unit_price_minor' => $unitPriceMinor,
                ]);
            }

            return $cart->fresh();
        });
    }

    public function updateItem(Cart $cart, string $itemRid, ?int $quantity = null, ?bool $selected = null): Cart
    {
        $item = $this->findCartItem($cart, $itemRid);

        if ($quantity !== null && $quantity < 1) {
            $item->delete();

            return $cart->fresh();
        }

        $updates = [];
        if ($quantity !== null) {
            $item->loadMissing('productVariant');
            $this->assertStock($item->productVariant, $quantity);
            $updates['quantity'] = $quantity;
        }
        if ($selected !== null) {
            $updates['selected'] = $selected;
        }

        if ($updates !== []) {
            $item->update($updates);
        }

        return $cart->fresh();
    }

    public function removeItem(Cart $cart, string $itemRid): Cart
    {
        $item = $this->findCartItem($cart, $itemRid);
        $item->delete();

        return $cart->fresh();
    }

    public function removeSelected(Cart $cart): Cart
    {
        $cart->items()->where('selected', true)->delete();

        return $cart->fresh();
    }

    public function selectAll(Cart $cart, bool $selected): Cart
    {
        $cart->items()->update(['selected' => $selected]);

        return $cart->fresh();
    }

    public function moveSelectedToWishlist(User $user, Cart $cart): Cart
    {
        return DB::transaction(function () use ($user, $cart): Cart {
            $selected = $cart->items()
                ->where('selected', true)
                ->with('product')
                ->get();

            foreach ($selected as $item) {
                Wishlist::query()->firstOrCreate(
                    [
                        'user_id' => $user->id,
                        'product_id' => $item->product_id,
                    ],
                );
            }

            $cart->items()->where('selected', true)->delete();

            return $cart->fresh();
        });
    }

    /** On sign-in: merge a guest cart if the client sent one, without creating an empty cart otherwise. */
    public function mergeGuestCartIfPresent(Request $request, User $user): void
    {
        if ($this->guestCart($request) instanceof Cart) {
            $this->mergeGuestCartAfterLogin($request, $user);
        }
    }

    public function mergeGuestCartAfterLogin(Request $request, User $user): Cart
    {
        $userCart = $this->getOrCreateUserCart($user);
        $guestCart = $this->guestCart($request);

        if (! $guestCart || $guestCart->id === $userCart->id) {
            return $userCart;
        }

        // A guest cart from another currency is dropped rather than mixed into
        // a cart the customer already filled in a different one. An empty
        // account cart has nothing to conflict with, so it takes the guest's.
        if ($guestCart->currency_code !== $userCart->currency_code) {
            if ($userCart->items()->exists()) {
                $guestCart->delete();

                return $userCart;
            }

            $userCart->update(['currency_code' => $guestCart->currency_code]);
        }

        return DB::transaction(function () use ($guestCart, $userCart): Cart {
            $guestItems = $guestCart->items()->lockForUpdate()->get();

            foreach ($guestItems as $guestItem) {
                /** @var CartItem|null $existing */
                $existing = $userCart->items()
                    ->where('product_variant_id', $guestItem->product_variant_id)
                    ->lockForUpdate()
                    ->first();

                if ($existing instanceof CartItem) {
                    $existing->update([
                        'quantity' => $existing->quantity + $guestItem->quantity,
                        'unit_price_minor' => $guestItem->unit_price_minor,
                        'selected' => $existing->selected || $guestItem->selected,
                    ]);
                } else {
                    $userCart->items()->create([
                        'product_id' => $guestItem->product_id,
                        'product_variant_id' => $guestItem->product_variant_id,
                        'quantity' => $guestItem->quantity,
                        'selected' => $guestItem->selected,
                        'unit_price_minor' => $guestItem->unit_price_minor,
                    ]);
                }
            }

            $guestCart->delete();

            return $userCart->fresh();
        });
    }

    /**
     * Totals for the selected lines, to the owner's default address (guests
     * have no destination yet).
     *
     * @return array<string, mixed> see summaryFor()
     */
    public function summary(Cart $cart): array
    {
        $owner = $cart->user_id !== null ? User::query()->find($cart->user_id) : null;

        return $this->summaryFor($cart, $owner instanceof User ? DeliveryDestination::forUser($owner) : null);
    }

    /**
     * Prices are tax-exclusive. Tax needs a destination: without one `tax` is
     * null and `total` excludes it (`totalIncludesTax` false). Shipping without
     * a destination uses the rules that apply to any country.
     *
     * @return array{
     *     itemsTotal: array{amount: float|int, currency: string},
     *     itemsDiscount: array{amount: float|int, currency: string},
     *     subtotal: array{amount: float|int, currency: string},
     *     shipping: array{amount: float|int, currency: string},
     *     tax: array{amount: float|int, currency: string}|null,
     *     taxes: list<array{name: string, ratePercent: float, amount: array{amount: float|int, currency: string}}>,
     *     total: array{amount: float|int, currency: string},
     *     totalIncludesTax: bool
     * }
     */
    public function summaryFor(Cart $cart, ?string $destination): array
    {
        $cart->loadMissing(['items.product', 'items.productVariant']);

        $currency = $cart->currency_code;
        $selected = $cart->items->where('selected', true)->filter(fn (CartItem $item): bool => $item->isPurchasable());

        $itemsTotalMinor = 0;
        $subtotalMinor = 0;
        $taxLines = [];

        foreach ($selected as $item) {
            $unitMinor = $item->unitPriceMinorIn($currency);
            $qty = (int) $item->quantity;
            $lineSubtotal = $unitMinor * $qty;
            $subtotalMinor += $lineSubtotal;
            $taxLines[] = new TaxLine($item->rid, $lineSubtotal, $item->product->tax_class_id);

            $originalUnit = $this->originalUnitMinor($item, $currency);
            $lineOriginal = ($originalUnit !== null && $originalUnit > $unitMinor)
                ? ($originalUnit * $qty)
                : $lineSubtotal;
            $itemsTotalMinor += $lineOriginal;
        }

        $shippingMinor = $this->shipping->quoteLines($currency, $destination, $this->shipping->linesFor($selected, $currency))['feeMinor'];
        $tax = $this->taxes->calculate($destination, $taxLines, $shippingMinor);

        return [
            'itemsTotal' => money($itemsTotalMinor, $currency),
            'itemsDiscount' => money($subtotalMinor - $itemsTotalMinor, $currency),
            'subtotal' => money($subtotalMinor, $currency),
            'shipping' => money($shippingMinor, $currency),
            'tax' => $tax !== null ? money($tax['totalMinor'], $currency) : null,
            'taxes' => array_map(fn (array $component) => [
                'name' => $component['name'],
                'ratePercent' => $component['rateBp'] / 100,
                'amount' => money($component['amountMinor'], $currency),
            ], $tax['components'] ?? []),
            'total' => money($subtotalMinor + $shippingMinor + ($tax['totalMinor'] ?? 0), $currency),
            'totalIncludesTax' => $tax !== null,
        ];
    }

    /**
     * @return array{items: list<array<string, mixed>>, summary: array<string, mixed>}
     */
    public function toResponse(Cart $cart): array
    {
        $cart->loadMissing(['items.product', 'items.productVariant']);

        $items = $cart->items
            ->sortBy('id')
            ->values()
            ->map(fn (CartItem $item): array => $this->itemToArray($item, $cart->currency_code))
            ->all();

        return [
            'items' => $items,
            'summary' => $this->summary($cart),
        ];
    }

    public function toJsonResponse(Cart $cart, int $status = 200): JsonResponse
    {
        return response()
            ->json($this->toResponse($cart), $status)
            ->header('X-Cart-Id', $cart->rid)
            ->cookie('cart_id', $cart->rid, 60 * 24 * 30, '/', null, false, false, false, 'lax');
    }

    /**
     * @return array<string, mixed>
     */
    private function itemToArray(CartItem $item, string $currency): array
    {
        $product = $item->product;
        $variant = $item->productVariant;
        $currentMinor = $item->unitPriceMinorIn($currency);
        $priceMoney = money($currentMinor, $currency);

        return [
            'rid' => $item->rid,
            'name' => $product?->name ?? '',
            'variant' => $variant->name,
            'variantRid' => $variant->rid,
            'sku' => $variant->sku,
            'image' => $product?->image ?? '',
            'imageUrl' => $product?->image_url,
            'currency' => $currency,
            'price' => $priceMoney['amount'],
            'priceMoney' => $priceMoney,
            // Set when the price moved since the shopper last saw it; checkout
            // rejects the order with `price_changed` until they review it.
            'previousPrice' => $item->priceChanged() ? $this->previousPrice($item, $currency) : null,
            'quantity' => (int) $item->quantity,
            // null: stock is not tracked for this variant.
            'stockQuantity' => $variant->stock_quantity,
            'available' => $item->isPurchasable() && $variant->hasStockFor((int) $item->quantity),
            'selected' => (bool) $item->selected,
            'productRid' => $product?->rid ?? '',
        ];
    }

    /**
     * The price the shopper last saw (stored in the product's currency), in
     * the cart's currency.
     *
     * @return array{amount: float|int, currency: string}
     */
    public function previousPrice(CartItem $item, string $currency): array
    {
        return money($this->fx->convert((int) $item->unit_price_minor, $item->product->currency_code, $currency), $currency);
    }

    public function originalUnitMinor(CartItem $item, string $currency): ?int
    {
        $original = $item->product?->original_price_minor;

        return $original !== null ? $this->fx->convert((int) $original, $item->product->currency_code, $currency) : null;
    }

    private function guestCart(Request $request): ?Cart
    {
        $guestRid = $request->header('X-Cart-Id') ?: $request->cookie('cart_id');
        if (! is_string($guestRid) || $guestRid === '') {
            return null;
        }

        return Cart::query()->where('rid', $guestRid)->whereNull('user_id')->first();
    }

    /**
     * Record that the shopper has now seen today's price on these lines.
     *
     * @param  iterable<CartItem>  $items
     */
    public function acknowledgePrices(iterable $items): void
    {
        foreach ($items as $item) {
            if ($item->priceChanged()) {
                $item->update(['unit_price_minor' => $item->currentUnitPriceMinor()]);
            }
        }
    }

    private function assertStock(ProductVariant $variant, int $quantity): void
    {
        if (! $variant->hasStockFor($quantity)) {
            abort(api_error(
                'insufficient_stock',
                $variant->stock_quantity === 0
                    ? 'This item is out of stock.'
                    : "Only {$variant->stock_quantity} left in stock.",
                422,
                ['variantRid' => $variant->rid, 'available' => $variant->stock_quantity],
            ));
        }
    }

    private function findCartItem(Cart $cart, string $itemRid): CartItem
    {
        $item = $cart->items()->where('rid', $itemRid)->first();

        if (! $item) {
            abort(api_error('cart_item_not_found', 'Cart item not found.', 404));
        }

        return $item;
    }
}
