<?php

declare(strict_types=1);

namespace App\Payments\DTOs;

final class CheckoutRequest
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        public readonly string $customerEmail,
        public readonly int $amountMinor,
        public readonly string $currencyCode,
        public readonly string $reference,
        public readonly string $returnUrl,
        public readonly string $cancelReturnUrl,
        public readonly array $metadata = [],
    ) {}
}
