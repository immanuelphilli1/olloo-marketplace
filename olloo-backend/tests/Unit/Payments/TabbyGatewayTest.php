<?php

declare(strict_types=1);

namespace Tests\Unit\Payments;

use App\Enums\OrderPaymentStatus;
use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\User;
use App\Payments\DTOs\CheckoutRequest;
use App\Payments\Gateways\TabbyGateway;
use App\Services\ExternalRequestLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use InvalidArgumentException;
use Tests\Concerns\SeedsCurrencies;
use Tests\TestCase;

final class TabbyGatewayTest extends TestCase
{
    use RefreshDatabase;
    use SeedsCurrencies;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedCurrencies();
        config([
            'payments.providers.tabby.secret_key' => 'sk_test_x',
            'payments.providers.tabby.merchant_code' => 'M1',
            'payments.providers.tabby.base_url' => 'https://api.tabby.ai',
            'payments.providers.tabby.webhook_key' => '',
        ]);
    }

    private function gateway(): TabbyGateway
    {
        return new TabbyGateway(app(ExternalRequestLogger::class));
    }

    private function order(): Order
    {
        $user = User::factory()->create();

        return Order::query()->create([
            'user_id' => $user->id,
            'order_reference' => 'HCO-1',
            'currency_code' => 'AED',
            'items_total_minor' => 17900,
            'items_discount_minor' => 0,
            'shipping_minor' => 0,
            'tax_minor' => 0,
            'total_minor' => 17900,
            'status' => OrderStatus::PendingPayment,
            'payment_status' => OrderPaymentStatus::Unpaid,
        ]);
    }

    private function request(Order $order): CheckoutRequest
    {
        return new CheckoutRequest(
            customerEmail: 'a@b.c',
            amountMinor: 17900,
            currencyCode: 'AED',
            reference: 'pay_1',
            returnUrl: 'https://shop.test/return?reference=pay_1',
            cancelReturnUrl: 'https://shop.test/cancel?reference=pay_1',
            metadata: ['order_rid' => $order->rid],
        );
    }

    public function test_create_checkout_returns_web_url(): void
    {
        Http::fake([
            '*/api/v2/checkout' => Http::response([
                'id' => 'sess-1',
                'status' => 'created',
                'configuration' => ['available_products' => ['installments' => [['web_url' => 'https://checkout.tabby.ai/pay']]]],
                'payment' => ['id' => 'tb-uuid-1', 'status' => 'CREATED'],
            ], 200),
        ]);

        $session = $this->gateway()->createCheckout($this->request($this->order()));

        $this->assertSame('tb-uuid-1', $session->reference);
        $this->assertSame('https://checkout.tabby.ai/pay', $session->checkoutUrl);
    }

    public function test_rejected_session_throws_for_the_shopper(): void
    {
        Http::fake([
            '*/api/v2/checkout' => Http::response(['id' => 'sess-1', 'status' => 'rejected'], 200),
        ]);

        $this->expectException(InvalidArgumentException::class);
        $this->gateway()->createCheckout($this->request($this->order()));
    }

    public function test_verify_maps_authorized_to_paid(): void
    {
        Http::fake([
            '*/api/v1/payments/*' => Http::response([
                'id' => 'tb-uuid-1', 'status' => 'AUTHORIZED', 'amount' => '179.00', 'currency' => 'AED',
            ], 200),
        ]);

        $charge = $this->gateway()->verifyCharge('tb-uuid-1');

        $this->assertTrue($charge->paid);
        $this->assertSame(17900, $charge->amountMinor);
        $this->assertSame('AED', $charge->currencyCode);
    }

    public function test_parse_webhook_uses_meta_reference(): void
    {
        $event = $this->gateway()->parseWebhook(Request::create(
            '/webhooks/tabby',
            'POST',
            [],
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            (string) json_encode([
                'id' => 'wh-1', 'status' => 'authorized', 'amount' => '179.00', 'currency' => 'AED',
                'order' => ['reference_id' => 'HCO-1'],
                'meta' => ['payment_rid' => 'pay_1'],
            ]),
        ));

        $this->assertTrue($event->paid);
        $this->assertSame('pay_1', $event->reference);
    }
}
