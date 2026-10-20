<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Fulfilment lifecycle. Payment state lives separately in OrderPaymentStatus
 * so an order is never treated as ready to ship just because it exists.
 */
enum OrderStatus: string
{
    case PendingPayment = 'pending_payment';
    case Processing = 'processing';
    case Shipped = 'shipped';
    case Delivered = 'delivered';
    case Cancelled = 'cancelled';

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
            self::PendingPayment => 'Awaiting payment',
            self::Processing => 'Processing',
            self::Shipped => 'Shipped',
            self::Delivered => 'Delivered',
            self::Cancelled => 'Cancelled',
        };
    }

    /** Stock is held for the order in these states and returned on cancel. */
    public function holdsStock(): bool
    {
        return $this === self::PendingPayment || $this === self::Processing;
    }

    /** Staff may only dispatch an order once it is paid. */
    public function requiresPayment(): bool
    {
        return $this === self::Shipped || $this === self::Delivered;
    }
}
