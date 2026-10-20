<?php

declare(strict_types=1);

namespace Tests\Unit\Payments;

use App\Enums\OrderPaymentStatus;
use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\User;
use App\Payments\DTOs\CheckoutRequest;
use App\Payments\Gateways\TamaraGateway;
use App\Services\ExternalRequestLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\SeedsCurrencies;
use Tests\TestCase;

final class TamaraGatewayTest extends TestCase
{
    use RefreshDatabase;
    use SeedsCurrencies;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedCurrencies();
        config([
            'payments.providers.tamara.api_token' => 'tok',
            'payments.providers.tamara.notification_token' => 'ntok',
            'payments.providers.tamara.base_url' => 'https://api-sandbox.tamara.co',
        ]);
    }

    private function gateway(): TamaraGateway
    {
        return new TamaraGateway(app(ExternalRequestLogger::class));
    }

    private function order(): Order
    {
        $user = User::factory()->create();

        return Order::query()->create([
            'user_id' => $user->id,
            'order_reference' => 'HCO-1',
            'currency_code' => 'AED',
            'items_total_minor' => 30000,
            'items_discount_minor' => 0,
            'tax_minor' => 0,
            'shipping_minor' => 0,
            'total_minor' => 30000,
            'address_snapshot' => [
                'country' => 'United Arab Emirates',
                'countryCode' => 'AE',
                'firstName' => 'A',
                'lastName' => 'B',
                'phoneCountryCode' => '+971',
                'phoneNumber' => '501234567',
                'addressLine' => 'Street 1',
                'city' => 'Dubai',
            ],
            'status' => OrderStatus::PendingPayment,
            'payment_status' => OrderPaymentStatus::Unpaid,
        ]);
    }

    public function test_create_checkout_returns_checkout_url(): void
    {
        Http::fake([
            '*/checkout' => Http::response([
                'order_id' => 'tm-uuid-1', 'checkout_id' => 'c-1',
                'status' => 'new', 'checkout_url' => 'https://checkout.tamara.co/pay',
            ], 200),
        ]);

        $session = $this->gateway()->createCheckout(new CheckoutRequest(
            customerEmail: 'a@b.c',
            amountMinor: 30000,
            currencyCode: 'AED',
            reference: 'pay_1',
            returnUrl: 'https://shop.test/return?reference=pay_1',
            cancelReturnUrl: 'https://shop.test/cancel?reference=pay_1',
            metadata: ['order_rid' => $this->order()->rid],
        ));

        $this->assertSame('tm-uuid-1', $session->reference);
        $this->assertSame('https://checkout.tamara.co/pay', $session->checkoutUrl);
    }

    public function test_verify_maps_fully_captured_to_paid_with_captured_amount(): void
    {
        Http::fake([
            '*/orders/*' => Http::response([
                'order_id' => 'tm-uuid-1', 'status' => 'fully_captured',
                'total_amount' => ['amount' => 300, 'currency' => 'AED'],
                'captured_amount' => ['amount' => 300, 'currency' => 'AED'],
            ], 200),
        ]);

        $charge = $this->gateway()->verifyCharge('tm-uuid-1');

        $this->assertTrue($charge->paid);
        $this->assertSame(30000, $charge->amountMinor);
        $this->assertSame('AED', $charge->currencyCode);
    }

    public function test_parse_webhook_verifies_token_and_maps_events(): void
    {
        $approved = $this->gateway()->parseWebhook($this->signedRequest([
            'order_id' => 'tm-uuid-1', 'order_reference_id' => 'HCO-1', 'event_type' => 'order_approved', 'data' => [],
        ]));
        $this->assertFalse($approved->paid);
        $this->assertSame('tm-uuid-1', $approved->reference);

        $captured = $this->gateway()->parseWebhook($this->signedRequest([
            'order_id' => 'tm-uuid-1', 'order_reference_id' => 'HCO-1', 'event_type' => 'order_captured',
            'data' => ['captured_amount' => ['amount' => 300, 'currency' => 'AED']],
        ]));
        $this->assertTrue($captured->paid);
    }

    public function test_parse_webhook_rejects_bad_token(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->gateway()->parseWebhook(Request::create(
            '/webhooks/tamara?tamaraToken=bogus',
            'POST',
            [],
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            '{"order_id":"x","event_type":"order_captured"}',
        ));
    }

    /**
     * @param  array<string, mixed>  $body
     */
    private function signedRequest(array $body): Request
    {
        $header = rtrim(strtr(base64_encode('{"alg":"HS256"}'), '+/', '-_'), '=');
        $payload = rtrim(strtr(base64_encode((string) json_encode($body)), '+/', '-_'), '=');
        $sig = rtrim(strtr(base64_encode(hash_hmac('sha256', $header.'.'.$payload, 'ntok', true)), '+/', '-_'), '=');

        return Request::create(
            '/webhooks/tamara?tamaraToken='.$header.'.'.$payload.'.'.$sig,
            'POST',
            [],
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            (string) json_encode($body),
        );
    }
}
