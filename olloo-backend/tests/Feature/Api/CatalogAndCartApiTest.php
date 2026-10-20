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
use App\Services\CheckoutPaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use RuntimeException;
use Tests\Concerns\BuildsCheckout;
use Tests\TestCase;

final class CatalogAndCartApiTest extends TestCase
{
    use BuildsCheckout;
    use RefreshDatabase;

    public function test_products_list_is_rid_only_with_no_id_twin(): void
    {
        $product = $this->seedCatalog();

        $response = $this->getJson('/api/v1/products')->assertOk();
        $item = $response->json('items.0');

        $this->assertSame($product->rid, $item['rid']);
        $this->assertIsString($item['rid']);
        // rid is the only public identifier; there is no parallel `id` field.
        $this->assertArrayNotHasKey('id', $item);
        $this->assertSame(rtrim((string) config('app.url'), '/').'/images/p.jpg', $item['imageUrl']);
    }

    public function test_guest_cart_add_and_header(): void
    {
        $product = $this->seedCatalog();

        $response = $this->postJson('/api/v1/cart/items', [
            'productId' => $product->rid,
            'quantity' => 1,
        ])->assertOk();

        $this->assertNotEmpty($response->headers->get('X-Cart-Id'));
        $this->assertSame($product->rid, $response->json('items.0.productRid'));
        $this->assertIsString($response->json('items.0.rid'));
    }

    public function test_checkout_payment_intent_with_fake_gateway(): void
    {
        $product = $this->seedCatalog();
        $user = User::factory()->create();

        // Use a real login token (not actingAs) so the sanctum guard path is exercised.
        $token = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk()->json('accessToken');

        $this->addToCart($token, $product)->assertOk();
        $orderRid = $this->placeOrder($token, $this->createAddress($token))->assertCreated()->json('orderId');

        $this->paymentIntent($token, $orderRid)
            ->assertOk()
            ->assertJsonStructure(['checkoutUrl', 'paymentRid', 'provider', 'orderId', 'amount'])
            ->assertJsonPath('provider', 'fake')
            ->assertJsonPath('orderId', $orderRid)
            ->assertJsonPath('amount.amount', 199);
    }

    public function test_cart_survives_login_add_login_get_cart(): void
    {
        $product = $this->seedCatalog();
        $user = User::factory()->create();

        $login = fn () => $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk()->json('accessToken');

        $token1 = $login();

        $this->withToken($token1)
            ->postJson('/api/v1/cart/items', [
                'productId' => $product->rid,
                'quantity' => 1,
            ])
            ->assertOk()
            ->assertJsonCount(1, 'items');

        // Log in again (new token, same user) then read the cart.
        $token2 = $login();

        $this->withToken($token2)
            ->getJson('/api/v1/cart')
            ->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.productRid', $product->rid);
    }

    public function test_place_order_merges_guest_cart_and_creates_order(): void
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();

        $cart = $this->postJson('/api/v1/cart/items', [
            'productId' => $product->rid,
            'quantity' => 1,
        ])->assertOk();
        $cartRid = $cart->headers->get('X-Cart-Id');
        $itemRid = $cart->json('items.0.rid');

        $addressRid = $this->createAddress($token);

        $this->withHeader('X-Cart-Id', $cartRid);
        $this->placeOrder($token, $addressRid, [$itemRid])
            ->assertCreated()
            ->assertJsonStructure(['orderId', 'orderReference', 'status', 'paymentStatus', 'totalMoney'])
            ->assertJsonPath('status', 'pending_payment')
            ->assertJsonPath('paymentStatus', 'unpaid');
    }

    public function test_return_urls_carry_our_reference(): void
    {
        $product = $this->seedCatalog();
        $user = User::factory()->create();

        config(['payments.providers.fake.driver' => CapturingGateway::class]);
        CapturingGateway::$lastRequest = null;

        $this->actingAs($user, 'sanctum');

        $order = Order::query()->create([
            'order_reference' => '#HCORETURN1',
            'user_id' => $user->id,
            'status' => OrderStatus::PendingPayment,
            'payment_status' => OrderPaymentStatus::Unpaid,
            'currency_code' => 'AED',
            'items_total_minor' => 1000,
            'items_discount_minor' => 0,
            'shipping_minor' => 0,
            'total_minor' => 1000,
            'placed_at' => now(),
        ]);

        app(CheckoutPaymentService::class)->initiate(
            order: $order,
            customerEmail: $user->email,
            returnUrl: 'https://shop.test/checkout/return',
            cancelReturnUrl: 'https://shop.test/checkout/cancel',
        );

        $request = CapturingGateway::$lastRequest;
        $this->assertNotNull($request);
        $this->assertStringStartsWith(
            'https://shop.test/checkout/return?reference=',
            $request->returnUrl,
        );
        $this->assertStringStartsWith(
            'https://shop.test/checkout/cancel?reference=',
            $request->cancelReturnUrl,
        );
        $this->assertSame($request->reference, $this->referenceFromUrl($request->returnUrl));
        $this->assertSame($request->reference, $this->referenceFromUrl($request->cancelReturnUrl));
    }

    /**
     * Stripe rejects a relative success_url with "Not a valid URL", and the
     * config default is a path, so a gateway must always receive an absolute
     * http(s) URL. Absolute input is passed through untouched.
     */
    public function test_relative_return_urls_are_resolved_against_app_url(): void
    {
        $product = $this->seedCatalog();
        $user = User::factory()->create();

        config([
            'payments.providers.fake.driver' => CapturingGateway::class,
            'app.url' => 'https://shop.test',
            'payments.providers.fake.return_url' => '/checkout/return',
            'payments.providers.fake.cancel_return_url' => '/checkout/cancel',
        ]);
        CapturingGateway::$lastRequest = null;

        $this->actingAs($user, 'sanctum');

        $order = Order::query()->create([
            'order_reference' => '#HCOREL1',
            'user_id' => $user->id,
            'status' => OrderStatus::PendingPayment,
            'payment_status' => OrderPaymentStatus::Unpaid,
            'currency_code' => 'AED',
            'items_total_minor' => 1000,
            'items_discount_minor' => 0,
            'shipping_minor' => 0,
            'total_minor' => 1000,
            'placed_at' => now(),
        ]);

        // No URL arguments: the provider's own config decides.
        app(CheckoutPaymentService::class)->initiate(
            order: $order,
            customerEmail: $user->email,
        );

        $request = CapturingGateway::$lastRequest;
        $this->assertNotNull($request);
        $this->assertStringStartsWith('https://shop.test/checkout/return?reference=', $request->returnUrl);
        $this->assertStringStartsWith('https://shop.test/checkout/cancel?reference=', $request->cancelReturnUrl);

        // A base with a trailing slash must not double up.
        config(['app.url' => 'https://shop.test/']);
        CapturingGateway::$lastRequest = null;

        $second = Order::query()->create([
            'order_reference' => '#HCOREL2',
            'user_id' => $user->id,
            'status' => OrderStatus::PendingPayment,
            'payment_status' => OrderPaymentStatus::Unpaid,
            'currency_code' => 'AED',
            'items_total_minor' => 1000,
            'items_discount_minor' => 0,
            'shipping_minor' => 0,
            'total_minor' => 1000,
            'placed_at' => now(),
        ]);

        app(CheckoutPaymentService::class)->initiate(
            order: $second,
            customerEmail: $user->email,
            returnUrl: '/checkout/return',
            cancelReturnUrl: '/checkout/cancel',
        );

        $this->assertStringStartsWith(
            'https://shop.test/checkout/return?reference=',
            (string) CapturingGateway::$lastRequest?->returnUrl,
        );
    }

    /**
     * Each gateway redirects the shopper back on its own page, the same way
     * Google's OAuth redirect is its own setting, so the provider decides the
     * URLs rather than one app-wide setting.
     */
    public function test_each_provider_resolves_its_own_return_url(): void
    {
        $product = $this->seedCatalog();
        $user = User::factory()->create();

        config([
            'payments.providers.fake.driver' => CapturingGateway::class,
            'app.url' => 'https://shop.test',
        ]);

        foreach (['stripe', 'paystack', 'paypal', 'tabby', 'tamara', 'fake'] as $provider) {
            $this->assertSame(
                "/checkout/return/{$provider}",
                config("payments.providers.{$provider}.return_url"),
                "Missing {$provider} return URL.",
            );
            $this->assertSame(
                "/checkout/cancel/{$provider}",
                config("payments.providers.{$provider}.cancel_return_url"),
                "Missing {$provider} cancel URL.",
            );
        }

        $this->actingAs($user, 'sanctum');
        CapturingGateway::$lastRequest = null;

        $order = Order::query()->create([
            'order_reference' => '#HCOPERPROV',
            'user_id' => $user->id,
            'status' => OrderStatus::PendingPayment,
            'payment_status' => OrderPaymentStatus::Unpaid,
            'currency_code' => 'AED',
            'items_total_minor' => 1000,
            'items_discount_minor' => 0,
            'shipping_minor' => 0,
            'total_minor' => 1000,
            'placed_at' => now(),
        ]);

        // The fake driver stands in for whichever provider the currency picks.
        app(CheckoutPaymentService::class)->initiate(
            order: $order,
            customerEmail: $user->email,
            providerOverride: 'fake',
        );

        $this->assertStringStartsWith(
            'https://shop.test/checkout/return/fake?reference=',
            (string) CapturingGateway::$lastRequest?->returnUrl,
        );
        $this->assertStringStartsWith(
            'https://shop.test/checkout/cancel/fake?reference=',
            (string) CapturingGateway::$lastRequest?->cancelReturnUrl,
        );

        // A provider with no return URL configured is a misconfiguration, not
        // something to fall back to another provider's page.
        config(['payments.providers.fake.return_url' => null]);
        CapturingGateway::$lastRequest = null;

        $second = Order::query()->create([
            'order_reference' => '#HCOPERPROV2',
            'user_id' => $user->id,
            'status' => OrderStatus::PendingPayment,
            'payment_status' => OrderPaymentStatus::Unpaid,
            'currency_code' => 'AED',
            'items_total_minor' => 1000,
            'items_discount_minor' => 0,
            'shipping_minor' => 0,
            'total_minor' => 1000,
            'placed_at' => now(),
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('FAKE_RETURN_URL');

        app(CheckoutPaymentService::class)->initiate(
            order: $second,
            customerEmail: $user->email,
            providerOverride: 'fake',
        );
    }

    /**
     * A relative APP_URL cannot resolve a path, and guessing a host would send
     * the shopper off-site and lose the payment reference, so it fails loudly.
     */
    public function test_unresolvable_return_url_fails_loudly(): void
    {
        $product = $this->seedCatalog();
        $user = User::factory()->create();

        config([
            'payments.providers.fake.driver' => CapturingGateway::class,
            'app.url' => 'shop.test',
        ]);

        $this->actingAs($user, 'sanctum');

        $order = Order::query()->create([
            'order_reference' => '#HCOREL3',
            'user_id' => $user->id,
            'status' => OrderStatus::PendingPayment,
            'payment_status' => OrderPaymentStatus::Unpaid,
            'currency_code' => 'AED',
            'items_total_minor' => 1000,
            'items_discount_minor' => 0,
            'shipping_minor' => 0,
            'total_minor' => 1000,
            'placed_at' => now(),
        ]);

        $this->expectException(RuntimeException::class);

        app(CheckoutPaymentService::class)->initiate(
            order: $order,
            customerEmail: $user->email,
            returnUrl: '/checkout/return',
            cancelReturnUrl: '/checkout/cancel',
        );
    }

    public function test_payment_status_rejects_unauthenticated(): void
    {
        $this->seedCatalog();
        $user = User::factory()->create();

        $payment = Payment::query()->create([
            'user_id' => $user->id,
            'provider' => 'fake',
            'status' => 'pending',
            'amount_minor' => 1000,
            'currency_code' => 'AED',
        ]);

        $this->withToken('bogus-token')
            ->getJson('/api/v1/payments/'.$payment->rid)
            ->assertUnauthorized();
    }

    public function test_payment_status_returns_pending_for_owner(): void
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();

        $this->addToCart($token, $product)->assertOk();
        $orderRid = $this->placeOrder($token, $this->createAddress($token))->assertCreated()->json('orderId');
        $paymentRid = $this->paymentIntent($token, $orderRid)->assertOk()->json('paymentRid');

        $this->withToken($token)
            ->getJson('/api/v1/payments/'.$paymentRid)
            ->assertOk()
            ->assertJsonPath('rid', $paymentRid)
            ->assertJsonPath('status', 'pending')
            ->assertJsonPath('provider', 'fake');
    }

    public function test_payment_status_hidden_from_other_users(): void
    {
        $this->seedCatalog();
        $user = User::factory()->create();
        $other = User::factory()->create();

        $payment = Payment::query()->create([
            'user_id' => $user->id,
            'provider' => 'fake',
            'status' => 'pending',
            'amount_minor' => 1000,
            'currency_code' => 'AED',
        ]);

        $otherToken = $other->createToken('access')->plainTextToken;
        $this->withToken($otherToken)
            ->getJson('/api/v1/payments/'.$payment->rid)
            ->assertNotFound();
    }

    private function referenceFromUrl(string $url): ?string
    {
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);

        return is_string($query['reference'] ?? null) ? $query['reference'] : null;
    }
}

final class CapturingGateway implements PaymentGateway
{
    public static ?CheckoutRequest $lastRequest = null;

    public function key(): string
    {
        return 'fake';
    }

    public function createCheckout(CheckoutRequest $request): CheckoutSession
    {
        self::$lastRequest = $request;

        return new CheckoutSession(
            provider: 'fake',
            reference: $request->reference,
            checkoutUrl: 'https://payments.test/fake-checkout/'.$request->reference,
        );
    }

    public function parseWebhook(Request $request): WebhookEvent
    {
        throw new RuntimeException('Not used in this test.');
    }

    public function verifyCharge(string $externalReference): VerifiedCharge
    {
        throw new RuntimeException('Not used in this test.');
    }
}
