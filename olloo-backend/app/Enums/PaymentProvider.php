<?php

declare(strict_types=1);

namespace App\Enums;

enum PaymentProvider: string
{
    case Stripe = 'stripe';
    case Paystack = 'paystack';

    public function label(): string
    {
        return match ($this) {
            self::Stripe => 'Stripe',
            self::Paystack => 'Paystack',
        };
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
