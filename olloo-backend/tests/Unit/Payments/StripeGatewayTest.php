<?php

declare(strict_types=1);

namespace Tests\Unit\Payments;

use App\Models\ExternalRequestLog;
use App\Models\Payment;
use App\Payments\DTOs\CheckoutRequest;
use App\Payments\Gateways\StripeGateway;
use App\Services\ExternalRequestLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Tests\Concerns\SeedsCurrencies;
use Tests\TestCase;

final class StripeGatewayTest extends TestCase
{
    use RefreshDatabase;
    use SeedsCurrencies;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedCurrencies();

        config([
            'payments.providers.stripe.secret_key' => 'sk_test_123',
            'payments.providers.stripe.webhook_secret' => 'whsec_test',
            'payments.providers.stripe.base_url' => 'https://api.stripe.test',
        ]);
    }

    private function gateway(): StripeGateway
    {
        return new StripeGateway(app(ExternalRequestLogger::class));
    }

    private function request(?string $reference = null): CheckoutRequest
    {
        $reference ??= 'pay_1';

        return new CheckoutRequest(
            customerEmail: 'a@b.c',
            amountMinor: 17900,
            currencyCode: 'AED',
            reference: $reference,
            returnUrl: 'https://shop.test/checkout/return/stripe?reference='.$reference,
            cancelReturnUrl: 'https://shop.test/checkout/cancel/stripe?reference='.$reference,
        );
    }

    /**
     * A real committed payment, so the entity link the logger writes resolves
     * to a row rather than falling back to the bare reference.
     */
    private function seedPayment(): Payment
    {
        return Payment::query()->create([
            'provider' => 'stripe',
            'status' => 'pending',
            'amount_minor' => 17900,
            'currency_code' => 'AED',
        ]);
    }

    public function test_create_checkout_logs_the_call(): void
    {
        Http::fake([
            '*/v1/checkout/sessions' => Http::response([
                'id' => 'cs_test_1',
                'url' => 'https://checkout.stripe.test/pay/cs_test_1',
            ], 200),
        ]);

        $payment = $this->seedPayment();

        $session = $this->gateway()->createCheckout($this->request($payment->rid));

        $this->assertSame('cs_test_1', $session->reference);
        $this->assertSame('https://checkout.stripe.test/pay/cs_test_1', $session->checkoutUrl);

        $log = ExternalRequestLog::query()
            ->where('service', 'stripe')
            ->where('action', 'checkout.sessions.create')
            ->first();

        $this->assertNotNull($log, 'Stripe checkout must appear in Request History.');
        $this->assertTrue($log->success);
        $this->assertSame(200, $log->status_code);

        $this->assertDatabaseHas('external_request_log_entities', [
            'external_request_log_id' => $log->id,
            'entity_type' => Payment::class,
            'entity_id' => $payment->id,
            'entity_rid' => $payment->rid,
        ]);
    }

    public function test_create_checkout_sends_the_pinned_api_version_and_a_redacted_secret(): void
    {
        Http::fake([
            '*/v1/checkout/sessions' => Http::response(['id' => 'cs_test_1', 'url' => 'https://checkout.stripe.test/x'], 200),
        ]);

        $this->gateway()->createCheckout($this->request());

        $request = Http::recorded()->first()[0];

        $this->assertSame('Bearer sk_test_123', $request->header('Authorization')[0]);
        $this->assertNotSame('', $request->header('Stripe-Version')[0]);

        // The secret must never reach the log table.
        $this->assertStringNotContainsString(
            'sk_test_123',
            (string) ExternalRequestLog::query()->first()?->request_headers
        );
        $this->assertStringNotContainsString(
            'sk_test_123',
            (string) ExternalRequestLog::query()->first()?->request_url
        );
    }

    public function test_create_checkout_nested_params_are_form_encoded_for_stripe(): void
    {
        Http::fake([
            '*/v1/checkout/sessions' => Http::response(['id' => 'cs_test_1', 'url' => 'https://checkout.stripe.test/x'], 200),
        ]);

        $this->gateway()->createCheckout($this->request());

        $body = (string) Http::recorded()->first()[0]->body();

        $this->assertStringContainsString('line_items', $body);
        $this->assertStringContainsString('price_data', $body);
        $this->assertStringContainsString('unit_amount', $body);
    }

    public function test_rejected_create_is_logged_as_a_failure(): void
    {
        Http::fake([
            '*/v1/checkout/sessions' => Http::response([
                'error' => ['message' => 'No such coupon: expired'],
            ], 400),
        ]);

        $payment = $this->seedPayment();

        try {
            $this->gateway()->createCheckout($this->request($payment->rid));
            $this->fail('Expected a RuntimeException.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('No such coupon: expired', $e->getMessage());
        }

        $log = ExternalRequestLog::query()->where('service', 'stripe')->first();

        $this->assertNotNull($log, 'A rejected Stripe create must appear in Request History.');
        $this->assertFalse($log->success);
        $this->assertSame(400, $log->status_code);
    }

    public function test_connection_failure_is_logged_as_a_failure(): void
    {
        Http::fake(fn () => throw new ConnectionException('cURL error 28: Operation timed out'));

        $payment = $this->seedPayment();

        $this->expectException(RuntimeException::class);

        try {
            $this->gateway()->createCheckout($this->request($payment->rid));
        } finally {
            $log = ExternalRequestLog::query()->where('service', 'stripe')->first();

            $this->assertNotNull($log, 'A Stripe connection failure must appear in Request History.');
            $this->assertFalse($log->success);
            $this->assertSame(ConnectionException::class, $log->exception_class);
        }
    }

    public function test_verify_charge_reads_a_checkout_session(): void
    {
        Http::fake([
            '*/v1/checkout/sessions/*' => Http::response([
                'id' => 'cs_test_1',
                'status' => 'complete',
                'payment_status' => 'paid',
                'amount_total' => 17900,
                'currency' => 'aed',
            ], 200),
        ]);

        $this->seedPayment();

        $charge = $this->gateway()->verifyCharge('cs_test_1');

        $this->assertTrue($charge->paid);
        $this->assertSame(17900, $charge->amountMinor);
        $this->assertSame('AED', $charge->currencyCode);

        $this->assertDatabaseHas('external_request_logs', [
            'service' => 'stripe',
            'action' => 'checkout.sessions.retrieve',
            'success' => true,
        ]);
    }

    public function test_verify_charge_reads_a_payment_intent(): void
    {
        Http::fake([
            '*/v1/payment_intents/*' => Http::response([
                'id' => 'pi_test_1',
                'status' => 'succeeded',
                'amount' => 17900,
                'currency' => 'aed',
            ], 200),
        ]);

        $payment = $this->seedPayment();
        $payment->update(['external_reference' => 'pi_test_1']);

        $charge = $this->gateway()->verifyCharge('pi_test_1');

        $this->assertTrue($charge->paid);
        $this->assertSame(17900, $charge->amountMinor);

        $this->assertDatabaseHas('external_request_logs', [
            'service' => 'stripe',
            'action' => 'payment_intents.retrieve',
            'success' => true,
        ]);

        // Settlement verifies by external reference, so that is the key the
        // logger has to resolve back to the payment row.
        $this->assertDatabaseHas('external_request_log_entities', [
            'entity_type' => Payment::class,
            'entity_id' => $payment->id,
        ]);
    }

    public function test_verify_charge_logs_a_failure(): void
    {
        Http::fake([
            '*/v1/checkout/sessions/*' => Http::response([
                'error' => ['message' => 'No such checkout.session: cs_missing'],
            ], 404),
        ]);

        $this->seedPayment();

        $this->expectException(RuntimeException::class);

        try {
            $this->gateway()->verifyCharge('cs_missing');
        } finally {
            $this->assertDatabaseHas('external_request_logs', [
                'service' => 'stripe',
                'action' => 'checkout.sessions.retrieve',
                'success' => false,
            ]);
        }
    }

    public function test_missing_secret_fails_loudly_without_calling_stripe(): void
    {
        config(['payments.providers.stripe.secret_key' => '']);
        Http::fake();

        $this->expectException(RuntimeException::class);

        try {
            $this->gateway()->createCheckout($this->request());
        } finally {
            $this->assertSame(0, Http::recorded()->count());
        }
    }
}
