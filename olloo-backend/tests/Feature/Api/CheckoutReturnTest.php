<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Enums\OrderPaymentStatus;
use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Payments\Contracts\PaymentGateway;
use App\Payments\DTOs\CheckoutRequest;
use App\Payments\DTOs\CheckoutSession;
use App\Payments\DTOs\VerifiedCharge;
use App\Payments\DTOs\WebhookEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Queue;
use Tests\Concerns\SeedsCurrencies;
use Tests\TestCase;

/**
 * Gateways return the shopper to /checkout/return/{provider}. We verify the
 * payment, then bounce them to the storefront with our reference so the web
 * client can render the outcome.
 */
final class CheckoutReturnTest extends TestCase
{
    use RefreshDatabase;
    use SeedsCurrencies;

    public function test_return_verifies_payment_and_redirects_to_storefront(): void
    {
        [$payment] = $this->scenario(PaidCharge::class);

        $response = $this->get('/checkout/return/stripe?reference='.$payment->rid.'&session_id=cs_test_1');

        $response->assertRedirect();
        $location = (string) $response->headers->get('Location');
        $this->assertStringStartsWith('https://shop.example/checkout/return?', $location);

        parse_str((string) parse_url($location, PHP_URL_QUERY), $query);
        $this->assertSame($payment->rid, $query['reference']);
        $this->assertSame('stripe', $query['provider']);
        $this->assertSame('completed', $query['status']);
        $this->assertSame('ORD-RETURN1', $query['orderReference']);
        $this->assertArrayHasKey('orderId', $query);
        // Formatted money, not raw minor units, and the same shape the API emits.
        $this->assertSame('228.9', $query['amount']);
        $this->assertSame('AED', $query['currency']);

        // The provider was actually asked, not trusted from the browser.
        $this->assertSame(['cs_test_1'], PaidCharge::$verified);
        $this->assertSame('completed', $payment->fresh()?->status);
        $this->assertSame(OrderPaymentStatus::Paid, $payment->fresh()?->order?->payment_status);
    }

    public function test_the_external_reference_is_used_when_there_is_one(): void
    {
        [$payment] = $this->scenario(PaidCharge::class, externalReference: 'cs_test_9');

        $this->get('/checkout/return/stripe?reference='.$payment->rid)
            ->assertRedirect();

        $this->assertSame(['cs_test_9'], PaidCharge::$verified);
    }

    public function test_unpaid_charge_redirects_with_its_real_status(): void
    {
        [$payment] = $this->scenario(UnpaidCharge::class);

        $response = $this->get('/checkout/return/stripe?reference='.$payment->rid);
        parse_str((string) parse_url((string) $response->headers->get('Location'), PHP_URL_QUERY), $query);

        $this->assertSame('failed', $query['status']);
        $this->assertSame('failed', $payment->fresh()?->status);
        $this->assertSame(OrderPaymentStatus::Failed, $payment->fresh()?->order?->payment_status);
    }

    public function test_provider_outage_still_redirects_with_the_stored_status(): void
    {
        [$payment] = $this->scenario(ExplodingCharge::class);

        $response = $this->get('/checkout/return/stripe?reference='.$payment->rid);

        $response->assertRedirect();
        parse_str((string) parse_url((string) $response->headers->get('Location'), PHP_URL_QUERY), $query);
        $this->assertSame($payment->rid, $query['reference']);
        $this->assertSame('pending', $query['status'], 'A gateway outage must not strand the shopper.');
    }

    public function test_cancel_redirects_to_the_storefront_cancel_page(): void
    {
        [$payment] = $this->scenario(PaidCharge::class);

        $response = $this->get('/checkout/cancel/stripe?reference='.$payment->rid);

        $response->assertRedirect();
        $location = (string) $response->headers->get('Location');
        $this->assertStringStartsWith('https://shop.example/checkout/cancel?', $location);

        parse_str((string) parse_url($location, PHP_URL_QUERY), $query);
        $this->assertSame('cancelled', $query['status']);
        $this->assertSame($payment->rid, $query['reference']);
        $this->assertSame([], PaidCharge::$verified, 'A cancel is not a payment to verify.');
    }

    public function test_a_payment_from_another_provider_is_not_exposed(): void
    {
        [$payment] = $this->scenario(PaidCharge::class);

        // The payment belongs to stripe; a paystack return must not resolve it.
        $location = (string) $this->get('/checkout/return/paystack?reference='.$payment->rid)
            ->assertRedirect()
            ->headers->get('Location');

        $this->assertStringContainsString('status=unknown', $location);
        $this->assertStringNotContainsString('ORD-RETURN1', $location);
        $this->assertSame([], PaidCharge::$verified, 'A payment must not be verified under another provider path.');
    }

    public function test_unknown_provider_is_not_found(): void
    {
        $this->get('/checkout/return/notaprovider?reference=pay_1')->assertNotFound();
    }

    public function test_unknown_reference_redirects_without_leaking(): void
    {
        $location = (string) $this->get('/checkout/return/stripe?reference=pay_NOPE')
            ->assertRedirect()
            ->headers->get('Location');

        $this->assertStringContainsString('status=unknown', $location);
        $this->assertStringNotContainsString('pay_NOPE', $location);
    }

    /**
     * The redirect target is our configured storefront, never the query string,
     * so a hostile link cannot bounce the shopper (or a payment reference) off
     * to another host.
     */
    public function test_the_redirect_cannot_be_pointed_at_another_host(): void
    {
        [$payment] = $this->scenario(PaidCharge::class);

        $location = (string) $this->get(
            '/checkout/return/stripe?reference='.$payment->rid
                .'&redirect=https://evil.test/steal&next=//evil.test'
        )->headers->get('Location');

        $this->assertStringStartsWith('https://shop.example/', $location);
        $this->assertStringNotContainsString('evil.test', $location);
    }

    public function test_a_hostile_reference_is_dropped_rather_than_reflected(): void
    {
        [$payment] = $this->scenario(PaidCharge::class);

        $location = (string) $this->get(
            '/checkout/return/stripe?reference='.urlencode('<script>alert(1)</script>')
        )->headers->get('Location');

        $this->assertStringNotContainsString('script', $location);
        $this->assertStringNotContainsString('reference=', $location);
        $this->assertStringContainsString('status=unknown', $location);
    }

    public function test_return_works_without_authentication(): void
    {
        [$payment] = $this->scenario(PaidCharge::class);

        $this->assertGuest();

        $this->get('/checkout/return/stripe?reference='.$payment->rid)->assertRedirect();
    }

    public function test_every_provider_return_path_has_a_route(): void
    {
        $this->assertSame(
            route('checkout.return', ['provider' => 'stripe']),
            url('/checkout/return/stripe'),
            'The route must match payments.providers.stripe.return_url.',
        );

        foreach (array_keys(config('payments.providers')) as $provider) {
            $this->assertSame(
                '/checkout/return/'.$provider,
                parse_url((string) config("payments.providers.{$provider}.return_url"), PHP_URL_PATH),
                "{$provider} return URL must have a matching route.",
            );
            $this->assertSame(
                '/checkout/cancel/'.$provider,
                parse_url((string) config("payments.providers.{$provider}.cancel_return_url"), PHP_URL_PATH),
                "{$provider} cancel URL must have a matching route.",
            );
        }
    }

    /**
     * A missing or relative WEB_CLIENT_URL is a misconfiguration: guessing a
     * host would drop the shopper somewhere they cannot check the payment.
     */
    public function test_missing_storefront_url_fails_loudly(): void
    {
        [$payment] = $this->scenario(PaidCharge::class);
        config(['services.storefront.url' => null]);

        $this->withoutExceptionHandling();

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('WEB_CLIENT_URL');

        $this->get('/checkout/return/stripe?reference='.$payment->rid);
    }

    /**
     * @param  class-string  $gateway
     * @return array{0: Payment}
     */
    private function scenario(string $gateway, ?string $externalReference = null, string $orderReference = 'ORD-RETURN1'): array
    {
        Queue::fake();

        $this->seedCurrencies();

        config([
            'services.storefront.url' => 'https://shop.example',
            'payments.providers.stripe.driver' => $gateway,
        ]);

        PaidCharge::reset();
        UnpaidCharge::reset();
        ExplodingCharge::reset();

        $user = User::factory()->create();

        $order = Order::query()->create([
            'order_reference' => $orderReference,
            'user_id' => $user->id,
            'status' => OrderStatus::PendingPayment,
            'payment_status' => OrderPaymentStatus::Unpaid,
            'currency_code' => 'AED',
            'items_total_minor' => 22890,
            'items_discount_minor' => 0,
            'shipping_minor' => 0,
            'total_minor' => 22890,
            'placed_at' => now(),
        ]);

        $payment = Payment::query()->create([
            'order_id' => $order->id,
            'user_id' => $user->id,
            'provider' => 'stripe',
            'status' => 'pending',
            'amount_minor' => 22890,
            'currency_code' => 'AED',
            'external_reference' => $externalReference ?? 'cs_test_1',
            'checkout_url' => 'https://checkout.stripe.com/c/pay/'.($externalReference ?? 'cs_test_1'),
        ]);

        return [$payment];
    }
}

abstract class VerifyOnlyGateway implements PaymentGateway
{
    /** @var list<string> */
    public static array $verified = [];

    public static function reset(): void
    {
        static::$verified = [];
    }

    public function key(): string
    {
        return 'stripe';
    }

    public function createCheckout(CheckoutRequest $request): CheckoutSession
    {
        return new CheckoutSession(provider: 'stripe', reference: 'x', checkoutUrl: 'https://example.test', raw: []);
    }

    public function parseWebhook(Request $request): WebhookEvent
    {
        return new WebhookEvent(provider: 'stripe', externalEventId: 'x', eventType: 'x', reference: null, payload: [], paid: false);
    }

    public function verifyCharge(string $externalReference): VerifiedCharge
    {
        static::$verified[] = $externalReference;

        return $this->charge($externalReference);
    }

    abstract protected function charge(string $externalReference): VerifiedCharge;
}

final class PaidCharge extends VerifyOnlyGateway
{
    /** @var list<string> */
    public static array $verified = [];

    protected function charge(string $externalReference): VerifiedCharge
    {
        return new VerifiedCharge(
            externalReference: $externalReference,
            status: 'paid',
            paid: true,
            amountMinor: 22890,
            currencyCode: 'AED',
        );
    }
}

final class UnpaidCharge extends VerifyOnlyGateway
{
    /** @var list<string> */
    public static array $verified = [];

    protected function charge(string $externalReference): VerifiedCharge
    {
        return new VerifiedCharge(
            externalReference: $externalReference,
            status: 'failed',
            paid: false,
            amountMinor: null,
            currencyCode: null,
        );
    }
}

final class ExplodingCharge extends VerifyOnlyGateway
{
    /** @var list<string> */
    public static array $verified = [];

    protected function charge(string $externalReference): VerifiedCharge
    {
        throw new \RuntimeException('Provider is down.');
    }
}
