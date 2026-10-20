<?php

declare(strict_types=1);

namespace Tests\Unit\Payments;

use App\Payments\DTOs\CheckoutRequest;
use App\Payments\Gateways\PaypalGateway;
use App\Services\ExternalRequestLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

final class PaypalGatewayTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'payments.providers.paypal.client_id' => 'cid',
            'payments.providers.paypal.secret' => 'csec',
            'payments.providers.paypal.webhook_id' => 'WH-1',
            'payments.providers.paypal.sandbox' => true,
        ]);
        Http::fake([
            '*/v1/oauth2/token' => Http::response(['access_token' => 'tok', 'expires_in' => 28800], 200),
        ]);
    }

    private function gateway(): PaypalGateway
    {
        return new PaypalGateway(app(ExternalRequestLogger::class));
    }

    private function request(): CheckoutRequest
    {
        return new CheckoutRequest(
            customerEmail: 'a@b.c',
            amountMinor: 17900,
            currencyCode: 'AED',
            reference: 'pay_1',
            returnUrl: 'https://shop.test/return?reference=pay_1',
            cancelReturnUrl: 'https://shop.test/cancel?reference=pay_1',
        );
    }

    public function test_create_checkout_returns_approve_url(): void
    {
        Http::fake([
            '*/v1/oauth2/token' => Http::response(['access_token' => 'tok'], 200),
            '*/v2/checkout/orders' => Http::response([
                'id' => 'PP-ORDER-1',
                'links' => [['rel' => 'approve', 'href' => 'https://paypal.test/approve']],
            ], 201),
        ]);

        $session = $this->gateway()->createCheckout($this->request());

        $this->assertSame('PP-ORDER-1', $session->reference);
        $this->assertSame('https://paypal.test/approve', $session->checkoutUrl);
    }

    public function test_verify_reports_completed_capture(): void
    {
        Http::fake([
            '*/v1/oauth2/token' => Http::response(['access_token' => 'tok'], 200),
            '*/v2/checkout/orders/*' => Http::response([
                'id' => 'PP-ORDER-1',
                'status' => 'COMPLETED',
                'purchase_units' => [[
                    'payments' => ['captures' => [[
                        'id' => 'CAP-1', 'status' => 'COMPLETED',
                        'amount' => ['value' => '179.00', 'currency_code' => 'AED'],
                    ]]],
                ]],
            ], 200),
        ]);

        $charge = $this->gateway()->verifyCharge('PP-ORDER-1');

        $this->assertTrue($charge->paid);
        $this->assertSame(17900, $charge->amountMinor);
        $this->assertSame('AED', $charge->currencyCode);
    }

    public function test_verify_is_unpaid_before_capture(): void
    {
        Http::fake([
            '*/v1/oauth2/token' => Http::response(['access_token' => 'tok'], 200),
            '*/v2/checkout/orders/*' => Http::response(['id' => 'PP-ORDER-1', 'status' => 'APPROVED'], 200),
        ]);

        $charge = $this->gateway()->verifyCharge('PP-ORDER-1');

        $this->assertFalse($charge->paid);
        $this->assertSame('approved', $charge->status);
    }

    public function test_parse_webhook_maps_approved_and_captured(): void
    {
        Http::fake([
            '*/v1/oauth2/token' => Http::response(['access_token' => 'tok'], 200),
            '*/v1/notifications/verify-webhook-signature' => Http::response(['verification_status' => 'SUCCESS'], 200),
        ]);

        $approved = $this->gateway()->parseWebhook($this->webhookRequest('CHECKOUT.ORDER.APPROVED', [
            'id' => 'PP-ORDER-1', 'custom_id' => 'pay_1',
        ]));
        $this->assertFalse($approved->paid);
        $this->assertSame('pay_1', $approved->reference);

        $captured = $this->gateway()->parseWebhook($this->webhookRequest('PAYMENT.CAPTURE.COMPLETED', [
            'id' => 'CAP-1',
            'custom_id' => 'pay_1',
            'supplementary_data' => ['related_ids' => ['order_id' => 'PP-ORDER-1']],
        ]));
        $this->assertTrue($captured->paid);
        $this->assertSame('pay_1', $captured->reference);
    }

    /**
     * @param  array<string, mixed>  $resource
     */
    private function webhookRequest(string $eventType, array $resource): Request
    {
        return Request::create(
            '/webhooks/paypal',
            'POST',
            [],
            [],
            [],
            [
                'HTTP_PAYPAL_TRANSMISSION_ID' => 't1',
                'HTTP_PAYPAL_TRANSMISSION_TIME' => 'now',
                'HTTP_PAYPAL_CERT_URL' => 'https://cert',
                'HTTP_PAYPAL_AUTH_ALGO' => 'algo',
                'HTTP_PAYPAL_TRANSMISSION_SIG' => 'sig',
                'CONTENT_TYPE' => 'application/json',
            ],
            (string) json_encode(['id' => 'WH-1', 'event_type' => $eventType, 'resource' => $resource]),
        );
    }
}
