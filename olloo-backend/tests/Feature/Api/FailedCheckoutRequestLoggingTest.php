<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Currency;
use App\Models\ExternalRequestLog;
use App\Models\Payment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\BuildsCheckout;
use Tests\TestCase;

/**
 * A provider call that fails mid-checkout must still leave a Request History
 * row. The outbound call happened; the fact that we then rolled back is a
 * detail of our own database, not a reason to erase the evidence.
 */
final class FailedCheckoutRequestLoggingTest extends TestCase
{
    use BuildsCheckout;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'payments.providers.paystack.secret_key' => 'sk_test',
            'payments.providers.paystack.base_url' => 'https://api.paystack.test',
            'payments.providers.paystack.return_url' => 'https://shop.test/checkout/return/paystack',
            'payments.providers.paystack.cancel_return_url' => 'https://shop.test/checkout/cancel/paystack',
        ]);
    }

    /**
     * @return array{0: string, 1: string} token, order rid
     */
    private function orderOnPaystack(): array
    {
        $product = $this->seedCatalog();

        // Repoint the currency the order will actually be charged in. The default is
        // USD, so redirecting AED here would leave the order on the fake
        // provider and the Paystack path would never be exercised.
        Currency::query()->where('code', 'USD')->update(['payment_provider' => 'paystack']);

        [$user, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $orderRid = $this->placeOrder($token, $this->createAddress($token))->assertCreated()->json('orderId');

        return [$token, $orderRid];
    }

    public function test_rejected_provider_response_is_logged_and_the_payment_row_survives(): void
    {
        Http::fake([
            '*/transaction/initialize' => Http::response([
                'status' => false,
                'message' => 'No active channel to process transaction. Please contact merchant',
            ], 200),
        ]);

        [$token, $orderRid] = $this->orderOnPaystack();

        $this->paymentIntent($token, $orderRid)->assertStatus(500);

        $log = ExternalRequestLog::query()->where('service', 'paystack')->first();
        $this->assertNotNull($log, 'A rejected Paystack initialize must appear in Request History.');
        $this->assertSame('transaction.initialize', $log->action);
        $this->assertSame('outgoing', $log->direction);

        // HTTP 200 but the provider rejected the charge, so the row must not
        // read as a success just because the transport succeeded.
        $this->assertFalse($log->success);
        $this->assertStringContainsString('No active channel', (string) $log->response_body);

        $this->assertSame(1, Payment::query()->count(), 'The pending payment must survive a provider rejection.');
    }

    public function test_connection_failure_is_logged_and_the_payment_row_survives(): void
    {
        Http::fake(fn () => throw new ConnectionException('cURL error 28: timeout'));

        [$token, $orderRid] = $this->orderOnPaystack();

        $this->paymentIntent($token, $orderRid)->assertStatus(500);

        $log = ExternalRequestLog::query()->where('service', 'paystack')->first();
        $this->assertNotNull($log, 'A Paystack connection failure must appear in Request History.');
        $this->assertFalse($log->success);
        $this->assertNotNull($log->exception_class);

        $this->assertSame(1, Payment::query()->count(), 'The pending payment must survive a provider outage.');
    }
}
