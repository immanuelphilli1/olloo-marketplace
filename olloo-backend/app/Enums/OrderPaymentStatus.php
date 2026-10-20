<?php

declare(strict_types=1);

namespace App\Enums;

enum OrderPaymentStatus: string
{
    case Unpaid = 'unpaid';
    case Paid = 'paid';
    case Failed = 'failed';
    case Refunded = 'refunded';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public function label(): string
    {
        return match ($this) {
            self::Unpaid => 'Unpaid',
            self::Paid => 'Paid',
            self::Failed => 'Payment failed',
            self::Refunded => 'Refunded',
        };
    }
}
