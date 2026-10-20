<?php

declare(strict_types=1);

namespace App\Tax;

/** One taxable amount: a cart or order line (quantity included). */
final readonly class TaxLine
{
    public function __construct(
        public string $key,
        public int $amountMinor,
        public ?int $taxClassId,
    ) {}
}
