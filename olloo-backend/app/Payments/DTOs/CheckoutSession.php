<?php

declare(strict_types=1);

namespace App\Payments\DTOs;

final class CheckoutSession
{
    /**
     * @param  array<string, mixed>|null  $raw
     */
    public function __construct(
        public readonly string $provider,
        public readonly string $reference,
        public readonly string $checkoutUrl,
        public readonly ?array $raw = null,
    ) {}
}
