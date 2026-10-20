<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Enums\OrderStatus;
use App\Models\IdempotencyKey;
use App\Models\Order;
use App\Models\Payment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\Concerns\BuildsCheckout;
use Tests\TestCase;

/**
 * Idempotency rules for POST /orders and POST /checkout/payment-intent:
 * a key is scoped to one endpoint, an unchanged request always hashes the
 * same, only successful responses are replayed, and a failed attempt frees
 * the key for a corrected retry.
 */
final class IdempotencyTest extends TestCase
{
    use BuildsCheckout;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    public function test_one_key_can_cover_a_whole_checkout_session(): void
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();

        // The natural client model: one key per checkout, reused for both steps.
        $sessionKey = 'checkout-session-1';

        $orderRid = $this->placeOrder($token, $this->createAddress($token), key: $sessionKey)
            ->assertCreated()
            ->json('orderId');

        $this->paymentIntent($token, $orderRid, $sessionKey)
            ->assertOk()
            ->assertJsonPath('orderId', $orderRid);

        $this->assertSame(1, Order::query()->count());
        $this->assertSame(1, Payment::query()->count());
    }

    public function test_reordered_body_keys_are_the_same_request(): void
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $addressRid = $this->createAddress($token);
        $itemRid = $this->withToken($token)->getJson('/api/v1/cart')->json('items.0.rid');

        $first = $this->withToken($token)
            ->withHeader('Idempotency-Key', 'order-key-1')
            ->postJson('/api/v1/orders', ['addressId' => $addressRid, 'cartItemIds' => [$itemRid]])
            ->assertCreated();

        // Same logical request, JSON keys in the other order: replay, not a new order.
        $replay = $this->withToken($token)
            ->withHeader('Idempotency-Key', 'order-key-1')
            ->postJson('/api/v1/orders', ['cartItemIds' => [$itemRid], 'addressId' => $addressRid])
            ->assertCreated();

        $this->assertSame($first->json('orderId'), $replay->json('orderId'));
        $this->assertSame('true', $replay->headers->get('Idempotent-Replayed'));
        $this->assertSame(1, Order::query()->count());
    }

    public function test_same_key_with_a_different_request_after_a_success_is_rejected(): void
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $addressRid = $this->createAddress($token);
        $itemRid = $this->withToken($token)->getJson('/api/v1/cart')->json('items.0.rid');

        $this->placeOrder($token, $addressRid, [$itemRid], 'order-key-2')->assertCreated();

        $this->placeOrder($token, $addressRid, ['some-other-line'], 'order-key-2')
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'idempotency_key_reused')
            ->assertJsonPath('error.details.route', 'api.v1.orders.store');

        $this->assertSame(1, Order::query()->count());
    }

    public function test_failed_attempt_frees_the_key_for_a_corrected_retry(): void
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $addressRid = $this->createAddress($token);
        $itemRid = $this->withToken($token)->getJson('/api/v1/cart')->json('items.0.rid');

        // A bad address fails; the key must not be burned by the failure.
        $this->placeOrder($token, 'not-an-address', [$itemRid], 'order-key-3')
            ->assertNotFound()
            ->assertJsonPath('error.code', 'address_not_found');

        $this->assertSame(0, IdempotencyKey::query()->where('key', 'order-key-3')->count());

        $this->placeOrder($token, $addressRid, [$itemRid], 'order-key-3')->assertCreated();
        $this->assertSame(1, Order::query()->count());
    }

    public function test_price_conflict_does_not_replay_a_stale_error(): void
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $addressRid = $this->createAddress($token);
        $itemRid = $this->withToken($token)->getJson('/api/v1/cart')->json('items.0.rid');

        // The price moves after the shopper loaded checkout.
        $product->defaultVariant->update(['price_minor' => 19900]);

        $this->placeOrder($token, $addressRid, [$itemRid], 'order-key-4')
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'price_changed');

        // Retrying the same click with the same key now succeeds at the new price.
        $this->placeOrder($token, $addressRid, [$itemRid], 'order-key-4')
            ->assertCreated()
            ->assertJsonPath('totalMoney.amount', 219);

        $this->assertSame(1, Order::query()->count());
    }

    public function test_failed_payment_intent_can_be_retried_with_the_same_key(): void
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $orderRid = $this->placeOrder($token, $this->createAddress($token))->json('orderId');

        // Pay an order that is past payment: 409, key released.
        $order = Order::query()->where('rid', $orderRid)->firstOrFail();
        $order->update(['status' => OrderStatus::Cancelled]);

        $this->paymentIntent($token, $orderRid, 'pay-key-1')
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'order_not_payable');

        $this->assertSame(0, IdempotencyKey::query()->where('key', 'pay-key-1')->count());

        // The same key works again once the order is payable.
        $order->update(['status' => OrderStatus::PendingPayment]);
        $this->paymentIntent($token, $orderRid, 'pay-key-1')->assertOk();
    }

    public function test_missing_key_is_rejected(): void
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();

        $this->withToken($token)
            ->postJson('/api/v1/orders', [
                'addressId' => $this->createAddress($token),
                'cartItemIds' => [$this->withToken($token)->getJson('/api/v1/cart')->json('items.0.rid')],
            ])
            ->assertStatus(428)
            ->assertJsonPath('error.code', 'idempotency_key_required');
    }
}
