<?php

declare(strict_types=1);

namespace Tests\Unit\Payments;

use App\Enums\PaymentStatus;
use App\Payments\PaymentStatusMapper;
use PHPUnit\Framework\TestCase;

final class PaymentStatusMapperTest extends TestCase
{
    public function test_maps_known_statuses(): void
    {
        $mapper = new PaymentStatusMapper;

        $this->assertSame(PaymentStatus::Completed, $mapper->map('paid'));
        $this->assertSame(PaymentStatus::Completed, $mapper->map('success'));
        $this->assertSame(PaymentStatus::Failed, $mapper->map('failed'));
        $this->assertSame(PaymentStatus::Refunded, $mapper->map('refunded'));
        $this->assertSame(PaymentStatus::Pending, $mapper->map('pending'));
    }

    public function test_unknown_status_stays_pending_not_completed(): void
    {
        $mapper = new PaymentStatusMapper;
        $this->assertSame(PaymentStatus::Pending, $mapper->map('totally-unknown-xyz'));
    }
}
