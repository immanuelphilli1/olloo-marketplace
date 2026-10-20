<?php

declare(strict_types=1);

namespace App\Shipping;

/**
 * What the resolver needs to pick a rule for one group of items that share a
 * shipping class. A missing destination is null country; standard shipping
 * is a null class.
 */
final readonly class ShippingQuoteContext
{
    public function __construct(
        public string $currency,
        public ?string $country,
        public int $subtotalMinor,
        public ?int $shippingClassId = null,
    ) {}
}
