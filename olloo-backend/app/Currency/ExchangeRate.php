<?php

declare(strict_types=1);

namespace App\Currency;

use Carbon\CarbonInterface;

/**
 * One direction of a pair as the shopper is charged: the mid-market rate plus
 * the markup that hedges us against the rate moving before settlement.
 */
final readonly class ExchangeRate
{
    public function __construct(
        public string $from,
        public string $to,
        public float $midRate,
        public float $markupPercent,
        public ?CarbonInterface $fetchedAt,
        public ?string $source,
    ) {}

    public static function identity(string $code): self
    {
        return new self($code, $code, 1.0, 0.0, null, null);
    }

    public function effectiveRate(): float
    {
        return $this->midRate * (1 + $this->markupPercent / 100);
    }

    /**
     * @return array{from: string, to: string, midRate: float, markupPercent: float, effectiveRate: float, fetchedAt: string|null, source: string|null}
     */
    public function toArray(): array
    {
        return [
            'from' => $this->from,
            'to' => $this->to,
            'midRate' => $this->midRate,
            'markupPercent' => $this->markupPercent,
            'effectiveRate' => $this->effectiveRate(),
            'fetchedAt' => $this->fetchedAt?->toIso8601String(),
            'source' => $this->source,
        ];
    }
}
