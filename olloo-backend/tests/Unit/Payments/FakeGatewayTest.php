<?php

declare(strict_types=1);

namespace Tests\Unit\Payments;

use App\Models\Payment;
use App\Payments\Gateways\FakeGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\Concerns\SeedsCurrencies;
use Tests\TestCase;

final class FakeGatewayTest extends TestCase
{
    use RefreshDatabase;
    use SeedsCurrencies;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedCurrencies();
    }

    public function test_verify_reports_the_amount_and_currency_of_the_payment(): void
    {
        $payment = Payment::query()->create([
            'provider' => 'fake',
            'status' => 'pending',
            'amount_minor' => 19900,
            'currency_code' => 'AED',
            'external_reference' => 'fake-ref-1',
        ]);

        $charge = (new FakeGateway)->verifyCharge('fake-ref-1');
        $this->assertTrue($charge->paid);
        $this->assertSame(19900, $charge->amountMinor);
        $this->assertSame('AED', $charge->currencyCode);

        $this->assertSame(19900, (new FakeGateway)->verifyCharge($payment->rid)->amountMinor);
    }

    public function test_unknown_reference_is_not_paid(): void
    {
        $charge = (new FakeGateway)->verifyCharge('nothing-here');

        $this->assertFalse($charge->paid);
        $this->assertNull($charge->amountMinor);
    }

    public function test_refuses_to_run_in_production(): void
    {
        $this->app['env'] = 'production';

        $this->expectException(RuntimeException::class);
        new FakeGateway;
    }
}
