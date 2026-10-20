<?php

declare(strict_types=1);

namespace App\Payments\DTOs;

final class VerifiedCharge
{
    public function __construct(
        public readonly string $externalReference,
        public readonly string $status,
        public readonly bool $paid,
        public readonly ?int $amountMinor = null,
        public readonly ?string $currencyCode = null,
    ) {}
}
