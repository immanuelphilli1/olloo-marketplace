<?php

declare(strict_types=1);

namespace App\Payments;

use App\Enums\PaymentStatus;

final class PaymentStatusMapper
{
    public static function map(string $externalStatus): PaymentStatus
    {
        return match (strtolower(trim($externalStatus))) {
            'paid',
            'completed',
            'complete',
            'succeeded',
            'success',
            'successful' => PaymentStatus::Completed,
            'refunded',
            'reversed' => PaymentStatus::Refunded,
            'unpaid',
            'failed',
            'canceled',
            'cancelled',
            'abandoned',
            'expired' => PaymentStatus::Failed,
            default => PaymentStatus::Pending,
        };
    }
}
