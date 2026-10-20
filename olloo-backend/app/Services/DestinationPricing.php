<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Product;
use App\Tax\TaxCalculator;
use Illuminate\Support\Collection;

/**
 * Prepares product cards for the shopper's destination: delivery quote and
 * the tax rate their price will carry. Nothing is attached without a
 * destination, so the mapper shows neither.
 */
final class DestinationPricing
{
    public function __construct(
        private readonly DeliveryQuoteCache $deliveryQuotes,
        private readonly TaxCalculator $taxes,
    ) {}

    /**
     * @param  iterable<Product>  $products
     */
    public function attach(iterable $products, ?string $destination): void
    {
        $products = Collection::make($products);
        $this->deliveryQuotes->attach($products, $destination);

        foreach ($products as $product) {
            $product->setRelation('destinationTaxBp', $destination === null
                ? null
                : $this->taxes->effectiveRateBp($destination, $product->tax_class_id));
        }
    }
}
