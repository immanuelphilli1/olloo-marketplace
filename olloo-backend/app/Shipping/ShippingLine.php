<?php

declare(strict_types=1);

namespace App\Shipping;

/** One priced line to ship: its subtotal, shipping class and days before dispatch. */
final readonly class ShippingLine
{
    public function __construct(
        public int $subtotalMinor,
        public ?int $shippingClassId,
        public int $handlingDays,
    ) {}
}
