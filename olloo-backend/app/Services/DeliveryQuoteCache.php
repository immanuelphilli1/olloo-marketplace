<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Product;
use App\Models\ProductDeliveryQuote;
use App\Shipping\ShippingConfigurationException;
use App\Shipping\ShippingRuleResolver;
use Illuminate\Support\Collection;

/**
 * Keeps product_delivery_quotes in step with products, variants and shipping
 * rules, so listings can show and filter delivery without quoting each card.
 * One row per product per rule country, plus a NULL-country row for every
 * other destination. No row means no rule matches (delivery unknown).
 */
final class DeliveryQuoteCache
{
    public function __construct(
        private readonly ShippingService $shipping,
        private readonly ShippingRuleResolver $resolver,
    ) {}

    public function refreshProduct(Product $product): void
    {
        $product->loadMissing('defaultVariant');
        $rows = [];

        if ($product->defaultVariant !== null) {
            foreach ([...$this->resolver->ruleCountries(), null] as $country) {
                try {
                    $quote = $this->shipping->quoteForProduct($product, $country);
                } catch (ShippingConfigurationException) {
                    continue;
                }

                $rows[] = [
                    'country' => $country,
                    'fee_minor' => $quote['feeMinor'],
                    'is_free' => $quote['free'],
                    'days_min' => $quote['deliveryDays']['min'],
                    'days_max' => $quote['deliveryDays']['max'],
                ];
            }
        }

        $product->deliveryQuotes()->delete();
        $product->deliveryQuotes()->createMany($rows);
    }

    public function refreshAll(): int
    {
        $count = 0;
        Product::query()->with('defaultVariant')->orderBy('id')->each(function (Product $product) use (&$count): void {
            $this->refreshProduct($product);
            $count++;
        });

        return $count;
    }

    /**
     * Which stored row answers for a destination: its own when it has
     * country rules, else the NULL-country row.
     */
    public function quoteCountryFor(string $destination): ?string
    {
        return in_array($destination, $this->resolver->ruleCountries(), true) ? $destination : null;
    }

    /**
     * Attach each product's quote for the destination as the `deliveryQuote`
     * relation (null when the destination is unknown or no rule matches).
     *
     * @param  iterable<Product>  $products
     */
    public function attach(iterable $products, ?string $destination): void
    {
        $products = Collection::make($products);
        if ($products->isEmpty()) {
            return;
        }

        $quotes = collect();
        if ($destination !== null) {
            $quoteCountry = $this->quoteCountryFor($destination);
            $quotes = ProductDeliveryQuote::query()
                ->whereIn('product_id', $products->pluck('id'))
                ->when($quoteCountry === null, fn ($query) => $query->whereNull('country'), fn ($query) => $query->where('country', $quoteCountry))
                ->get()
                ->keyBy('product_id');
        }

        foreach ($products as $product) {
            $product->setRelation('deliveryQuote', $quotes->get($product->id));
        }
    }
}
