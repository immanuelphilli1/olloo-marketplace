<?php

declare(strict_types=1);

namespace App\Shipping;

/** Shopper-facing wording for a delivery estimate in business days. */
final class DeliveryWindow
{
    public static function days(int $min, int $max): string
    {
        if ($min === $max) {
            return $min === 1 ? '1 business day' : "{$min} business days";
        }

        return "{$min}-{$max} business days";
    }
}
