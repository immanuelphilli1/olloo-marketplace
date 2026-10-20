<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Enums\OrderPaymentStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Jobs\ProcessPaymentWebhook;
use App\Models\Category;
use App\Models\Currency;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Payments\DTOs\VerifiedCharge;
use App\Services\PaymentSettlementService;
use Database\Seeders\AdminPermissionsSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsCheckout;
use Tests\TestCase;

final class CheckoutIntegrityTest extends TestCase
{
    use BuildsCheckout;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    public function test_order_is_created_awaiting_payment_with_frozen_totals_and_held_stock(): void
    {
        $product = $this->seedCatalog(stock: 5);
        [, $token] = $this->customer();
        $this->addToCart($token, $product, 2)->assertOk();

        $orderRid = $this->placeOrder($token, $this->createAddress($token))
            ->assertCreated()
            ->assertJsonPath('status', 'pending_payment')
            ->assertJsonPath('paymentStatus', 'unpaid')
            ->assertJsonPath('totalMoney.amount', 378) // 2 x 179.00 + 20.00 shipping
            ->json('orderId');

        $order = Order::query()->where('rid', $orderRid)->firstOrFail();
        $this->assertSame(37800, $order->total_minor);
        $this->assertSame($this->defaultVariant($product)->sku, $order->items->first()->sku);
        $this->assertSame(3, $this->defaultVariant($product)->stock_quantity);
        $this->assertSame([], $this->withToken($token)->getJson('/api/v1/cart')->json('items'));
    }

    public function test_payment_intent_charges_exactly_the_order_total(): void
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $orderRid = $this->placeOrder($token, $this->createAddress($token))->json('orderId');

        $paymentRid = $this->paymentIntent($token, $orderRid)->assertOk()->json('paymentRid');

        $payment = Payment::query()->where('rid', $paymentRid)->firstOrFail();
        $this->assertSame(19900, $payment->amount_minor);
        $this->assertSame($orderRid, $payment->order?->rid);
    }

    public function test_payment_intent_requires_an_order(): void
    {
        $this->seedCatalog();
        [, $token] = $this->customer();

        $this->withToken($token)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/checkout/payment-intent', [])
            ->assertUnprocessable();
    }

    public function test_paid_or_cancelled_orders_cannot_be_charged_again(): void
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $orderRid = $this->placeOrder($token, $this->createAddress($token))->json('orderId');
        $order = Order::query()->where('rid', $orderRid)->firstOrFail();

        $order->update(['payment_status' => OrderPaymentStatus::Paid, 'status' => OrderStatus::Processing]);
        $this->paymentIntent($token, $orderRid)->assertStatus(409)->assertJsonPath('error.code', 'order_already_paid');

        $order->update(['payment_status' => OrderPaymentStatus::Unpaid, 'status' => OrderStatus::Cancelled]);
        $this->paymentIntent($token, $orderRid)->assertStatus(409)->assertJsonPath('error.code', 'order_not_payable');
    }

    public function test_price_change_blocks_the_order_until_the_customer_sees_it(): void
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $addressRid = $this->createAddress($token);

        $product->update(['price_minor' => 19900]);

        $this->withToken($token)->getJson('/api/v1/cart')
            ->assertJsonPath('items.0.price', 199)
            ->assertJsonPath('items.0.previousPrice.amount', 179);

        $this->placeOrder($token, $addressRid)
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'price_changed')
            ->assertJsonPath('error.details.items.0.price.amount', 199);

        // The conflict acknowledged the new price, so the retry goes through at it.
        $this->placeOrder($token, $addressRid)
            ->assertCreated()
            ->assertJsonPath('totalMoney.amount', 219);
    }

    public function test_stock_limits_cart_and_order(): void
    {
        $product = $this->seedCatalog(stock: 1);
        [, $token] = $this->customer();

        $this->addToCart($token, $product, 2)
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'insufficient_stock');

        $this->addToCart($token, $product, 1)->assertOk();
        $addressRid = $this->createAddress($token);

        // Someone else bought the last one in the meantime.
        $this->defaultVariant($product)->update(['stock_quantity' => 0]);

        $this->placeOrder($token, $addressRid)
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'insufficient_stock');
        $this->assertSame(0, Order::query()->count());
    }

    public function test_untracked_stock_never_sells_out(): void
    {
        $product = $this->seedCatalog(stock: null);
        [, $token] = $this->customer();

        $this->addToCart($token, $product, 500)->assertOk()->assertJsonPath('items.0.stockQuantity', null);
    }

    public function test_cart_refuses_a_product_it_has_no_rate_to_price(): void
    {
        $product = $this->seedCatalog();
        // seedCatalog already creates GHS; repoint this product at it so the
        // line needs a GHS rate the fixture never stores.
        $product->update(['currency_code' => 'GHS']);
        [, $token] = $this->customer();

        // The cart is in the shopper's currency (USD); with no GHS rate the
        // line cannot be priced, so it is refused rather than guessed.
        $this->addToCart($token, $product)->assertStatus(503)->assertJsonPath('error.code', 'exchange_rate_unavailable');
        $this->withToken($token)->getJson('/api/v1/cart')->assertOk()->assertJsonCount(0, 'items');
    }

    public function test_orders_require_an_idempotency_key(): void
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $addressRid = $this->createAddress($token);
        $itemRid = $this->withToken($token)->getJson('/api/v1/cart')->json('items.0.rid');

        $this->withToken($token)
            ->postJson('/api/v1/orders', ['addressId' => $addressRid, 'cartItemIds' => [$itemRid]])
            ->assertStatus(428)
            ->assertJsonPath('error.code', 'idempotency_key_required');
    }

    public function test_retried_order_replays_the_first_response_instead_of_failing(): void
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $addressRid = $this->createAddress($token);
        $itemRid = $this->withToken($token)->getJson('/api/v1/cart')->json('items.0.rid');

        $first = $this->placeOrder($token, $addressRid, [$itemRid], 'order-attempt-1')->assertCreated();
        $retry = $this->placeOrder($token, $addressRid, [$itemRid], 'order-attempt-1')->assertCreated();

        $this->assertSame($first->json('orderId'), $retry->json('orderId'));
        $this->assertSame('true', $retry->headers->get('Idempotent-Replayed'));
        $this->assertSame(1, Order::query()->count());

        $this->placeOrder($token, $addressRid, ['different-line'], 'order-attempt-1')
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'idempotency_key_reused');
    }

    public function test_retried_payment_intent_returns_the_same_payment(): void
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $orderRid = $this->placeOrder($token, $this->createAddress($token))->json('orderId');

        $first = $this->paymentIntent($token, $orderRid, 'pay-attempt-1')->assertOk()->json('paymentRid');
        $retry = $this->paymentIntent($token, $orderRid, 'pay-attempt-1')->assertOk()->json('paymentRid');

        $this->assertSame($first, $retry);
        $this->assertSame(1, Payment::query()->count());
    }

    public function test_settled_payment_marks_order_paid_and_processing(): void
    {
        [$order, $payment] = $this->unpaidOrderWithPayment();

        app(PaymentSettlementService::class)->applyVerifiedCharge($payment, $this->charge(19900));

        $order->refresh();
        $this->assertSame(OrderPaymentStatus::Paid, $order->payment_status);
        $this->assertSame(OrderStatus::Processing, $order->status);
        $this->assertSame(PaymentStatus::Completed->value, $payment->refresh()->status);
    }

    public function test_fake_provider_webhook_settles_the_order_through_the_amount_check(): void
    {
        [$order, $payment] = $this->unpaidOrderWithPayment();
        Queue::fake()->except([ProcessPaymentWebhook::class]);

        $this->postJson('/webhooks/fake', ['id' => 'evt_1', 'reference' => $payment->rid])->assertSuccessful();

        $this->assertSame(PaymentStatus::Completed->value, $payment->refresh()->status);
        $this->assertSame(OrderPaymentStatus::Paid, $order->refresh()->payment_status);
    }

    public function test_charge_for_a_different_amount_needs_review_and_leaves_order_unpaid(): void
    {
        [$order, $payment] = $this->unpaidOrderWithPayment();

        app(PaymentSettlementService::class)->applyVerifiedCharge($payment, $this->charge(100));

        $this->assertSame(PaymentStatus::NeedsReview->value, $payment->refresh()->status);
        $this->assertSame(OrderPaymentStatus::Unpaid, $order->refresh()->payment_status);
        $this->assertSame(OrderStatus::PendingPayment, $order->status);
    }

    public function test_second_payment_on_a_paid_order_needs_review(): void
    {
        [$order, $first] = $this->unpaidOrderWithPayment();
        $second = $first->replicate(['rid', 'external_reference']);
        $second->save();

        $settlement = app(PaymentSettlementService::class);
        $settlement->applyVerifiedCharge($first, $this->charge(19900));
        $settlement->applyVerifiedCharge($second, $this->charge(19900));

        $this->assertSame(PaymentStatus::Completed->value, $first->refresh()->status);
        $this->assertSame(PaymentStatus::NeedsReview->value, $second->refresh()->status);
        $this->assertSame(OrderPaymentStatus::Paid, $order->refresh()->payment_status);
    }

    public function test_failed_payment_keeps_order_payable(): void
    {
        [$order, $payment] = $this->unpaidOrderWithPayment();

        app(PaymentSettlementService::class)->applyVerifiedCharge(
            $payment,
            new VerifiedCharge(externalReference: 'ref', status: 'failed', paid: false),
        );

        $order->refresh();
        $this->assertSame(OrderPaymentStatus::Failed, $order->payment_status);
        $this->assertSame(OrderStatus::PendingPayment, $order->status);
    }

    public function test_unpaid_orders_expire_and_release_stock(): void
    {
        $product = $this->seedCatalog(stock: 3);
        [, $token] = $this->customer();
        $this->addToCart($token, $product, 2)->assertOk();
        $orderRid = $this->placeOrder($token, $this->createAddress($token))->json('orderId');
        $this->assertSame(1, $this->defaultVariant($product)->stock_quantity);

        $this->travel((int) config('payments.order_payment_window_minutes') + 1)->minutes();
        $this->artisan('orders:expire-unpaid')->assertSuccessful();

        $this->assertSame(OrderStatus::Cancelled, Order::query()->where('rid', $orderRid)->firstOrFail()->status);
        $this->assertSame(3, $this->defaultVariant($product)->stock_quantity);
    }

    public function test_payment_arriving_after_expiry_needs_review(): void
    {
        [$order, $payment] = $this->unpaidOrderWithPayment();
        $order->update(['status' => OrderStatus::Cancelled]);

        app(PaymentSettlementService::class)->applyVerifiedCharge($payment, $this->charge(19900));

        $this->assertSame(PaymentStatus::NeedsReview->value, $payment->refresh()->status);
        $this->assertSame(OrderStatus::Cancelled, $order->refresh()->status);
    }

    public function test_staff_cannot_ship_an_unpaid_order(): void
    {
        config(['admin.mfa_forced' => false]);
        [$order] = $this->unpaidOrderWithPayment();
        $staff = $this->staff();
        $prefix = trim((string) config('admin.path_prefix'), '/');

        $this->actingAs($staff, 'staff')
            ->put('/'.$prefix.'/orders/'.$order->rid.'/status', ['status' => 'shipped'])
            ->assertSessionHasErrors('status');
        $this->assertSame(OrderStatus::PendingPayment, $order->refresh()->status);

        $order->update(['payment_status' => OrderPaymentStatus::Paid, 'status' => OrderStatus::Processing]);
        $this->actingAs($staff, 'staff')
            ->put('/'.$prefix.'/orders/'.$order->rid.'/status', ['status' => 'shipped'])
            ->assertSessionHasNoErrors();
        $this->assertSame(OrderStatus::Shipped, $order->refresh()->status);
    }

    public function test_staff_cancel_releases_stock(): void
    {
        config(['admin.mfa_forced' => false]);
        $product = $this->seedCatalog(stock: 4);
        [, $token] = $this->customer();
        $this->addToCart($token, $product, 3)->assertOk();
        $orderRid = $this->placeOrder($token, $this->createAddress($token))->json('orderId');
        $prefix = trim((string) config('admin.path_prefix'), '/');

        $this->actingAs($this->staff(), 'staff')
            ->put('/'.$prefix.'/orders/'.$orderRid.'/status', ['status' => 'cancelled'])
            ->assertSessionHasNoErrors();

        $this->assertSame(4, $this->defaultVariant($product)->stock_quantity);
    }

    public function test_closing_an_account_keeps_orders_and_frees_the_email(): void
    {
        [$order] = $this->unpaidOrderWithPayment();
        $user = $order->user;
        $token = $user->createToken('access')->plainTextToken;

        $this->withToken($token)
            ->deleteJson('/api/v1/users/me', ['password' => 'password'])
            ->assertOk();

        $this->assertSoftDeleted($user);
        $this->assertModelExists($order);
        $this->assertSame($user->id, $order->refresh()->user?->id);

        $this->app['auth']->forgetGuards();
        $this->flushHeaders();
        $this->postJson('/api/v1/auth/register', [
            'email' => $user->email,
            'password' => 'Secret-pass-123',
            'password_confirmation' => 'Secret-pass-123',
            'fullName' => 'New Owner',
            'country' => 'AE',
        ])->assertSuccessful();

        $this->assertSame(2, User::withTrashed()->where('email', $user->email)->count());
    }

    public function test_hard_deleting_a_customer_with_orders_is_refused(): void
    {
        [$order] = $this->unpaidOrderWithPayment();

        $this->expectException(QueryException::class);
        $order->user->forceDelete();
    }

    public function test_deleting_a_category_never_deletes_its_products(): void
    {
        $product = $this->seedCatalog();

        try {
            Category::query()->whereKey($product->category_id)->delete();
            $this->fail('Deleting a category with products should be refused by the database.');
        } catch (QueryException) {
            $this->assertModelExists($product);
        }
    }

    /**
     * @return array{0: Order, 1: Payment}
     */
    private function unpaidOrderWithPayment(): array
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $orderRid = $this->placeOrder($token, $this->createAddress($token))->json('orderId');
        $paymentRid = $this->paymentIntent($token, $orderRid)->json('paymentRid');

        return [
            Order::query()->where('rid', $orderRid)->firstOrFail(),
            Payment::query()->where('rid', $paymentRid)->firstOrFail(),
        ];
    }

    private function charge(int $amountMinor): VerifiedCharge
    {
        return new VerifiedCharge(
            externalReference: 'ref-'.Str::random(6),
            status: 'completed',
            paid: true,
            amountMinor: $amountMinor,
            currencyCode: 'USD',
        );
    }

    private function staff(): User
    {
        $this->seed(AdminPermissionsSeeder::class);

        $staff = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-checkout@handco.test',
            'password' => 'password',
            'user_type' => 'staff',
            'email_verified_at' => now(),
            'must_change_password' => false,
            'two_factor_enabled' => false,
        ]);
        $staff->syncPermissions(AdminPermissionsSeeder::PERMISSIONS);

        return $staff;
    }
}
