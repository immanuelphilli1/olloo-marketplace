<?php

declare(strict_types=1);

namespace App\Services;

use App\Currency\CurrencyConverter;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Product;
use App\Shipping\DeliveryWindow;
use App\Shipping\ShippingLine;
use App\Shipping\ShippingQuoteContext;
use App\Shipping\ShippingRuleResolver;

/**
 * Portal-configured shipping quotes. Lines are grouped by shipping class;
 * each group is priced by its own matching rule and the fees are summed.
 * Delivery takes the slowest group: its longest handling time plus its
 * rule's transit days. Throws ShippingConfigurationException when a group
 * has no matching rule (fail closed, never a made-up fee).
 *
 * Amounts are in the quote currency; a rule written in another currency is
 * converted at the shopper rate (see ShippingRuleResolver).
 */
final class ShippingService
{
    public function __construct(
        private readonly ShippingRuleResolver $resolver,
        private readonly CurrencyConverter $fx,
    ) {}

    /**
     * @param  list<ShippingLine>  $lines
     * @return array{
     *     feeMinor: int,
     *     currency: string,
     *     free: bool,
     *     deliveryDays: array{min: int, max: int}|null,
     *     courierLabel: string,
     *     estimatedDelivery: string|null
     * }
     */
    public function quoteLines(string $currency, ?string $country, array $lines): array
    {
        $groups = [];
        foreach ($lines as $line) {
            $key = $line->shippingClassId ?? 0;
            $groups[$key]['subtotal'] = ($groups[$key]['subtotal'] ?? 0) + $line->subtotalMinor;
            $groups[$key]['handling'] = max($groups[$key]['handling'] ?? 0, $line->handlingDays);
            $groups[$key]['class'] = $line->shippingClassId;
        }

        $feeMinor = 0;
        $days = null;
        foreach ($groups as $group) {
            $rule = $this->resolver->resolve(new ShippingQuoteContext(
                currency: $currency,
                country: $country,
                subtotalMinor: $group['subtotal'],
                shippingClassId: $group['class'],
            ));

            $feeMinor += $this->fx->convert($rule->effectiveFeeMinor(), $rule->currency_code, $currency);
            $days = [
                'min' => max($days['min'] ?? 0, $group['handling'] + $rule->transit_days_min),
                'max' => max($days['max'] ?? 0, $group['handling'] + $rule->transit_days_max),
            ];
        }

        return [
            'feeMinor' => $feeMinor,
            'currency' => $currency,
            'free' => $groups !== [] && $feeMinor === 0,
            'deliveryDays' => $days,
            'courierLabel' => (string) config('shipping.courier_label'),
            'estimatedDelivery' => $days ? 'Estimated delivery: '.DeliveryWindow::days($days['min'], $days['max']) : null,
        ];
    }

    /**
     * Quote the cart's selected lines.
     *
     * @return array<string, mixed> see quoteLines()
     */
    public function quoteForCart(Cart $cart, ?string $country = null): array
    {
        $cart->loadMissing(['items.product', 'items.productVariant']);

        $items = $cart->items->where('selected', true)->filter(fn (CartItem $item): bool => $item->isPurchasable());

        $currency = (string) $cart->currency_code;

        return $this->quoteLines($currency, $country, $this->linesFor($items->all(), $currency));
    }

    /**
     * @param  iterable<CartItem>  $items
     * @return list<ShippingLine>
     */
    public function linesFor(iterable $items, string $currency): array
    {
        $lines = [];
        foreach ($items as $item) {
            $lines[] = new ShippingLine(
                subtotalMinor: $item->unitPriceMinorIn($currency) * (int) $item->quantity,
                shippingClassId: $item->product->shipping_class_id,
                handlingDays: $item->productVariant->effectiveHandlingDays(),
            );
        }

        return $lines;
    }

    /**
     * One unit of the product's default variant, as shown on product cards.
     *
     * @return array<string, mixed> see quoteLines()
     */
    public function quoteForProduct(Product $product, ?string $country): array
    {
        $variant = $product->defaultVariant ?? $product->defaultVariant()->firstOrFail();
        $variant->setRelation('product', $product);

        return $this->quoteLines($product->currency_code, $country, [
            new ShippingLine(
                subtotalMinor: $variant->unitPriceMinor(),
                shippingClassId: $product->shipping_class_id,
                handlingDays: $variant->effectiveHandlingDays(),
            ),
        ]);
    }
}
