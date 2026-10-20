<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Enums\OrderPaymentStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Payments\DTOs\VerifiedCharge;
use App\Services\PaymentSettlementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsCheckout;
use Tests\TestCase;

/**
 * A shopper may cancel their own order only while it is still awaiting payment.
 * Nothing has been charged at that point, so cancelling releases stock. Once an
 * order is paid, cancelling means refunding, which is a manual step for staff
 * and so is not offered to the shopper here.
 */
final class OrderCancellationTest extends TestCase
{
    use BuildsCheckout;
    use RefreshDatabase;

    public function test_a_shopper_cancels_an_unpaid_order_and_the_stock_goes_back(): void
    {
        $product = $this->seedCatalog(stock: 5);
        [, $token] = $this->customer();
        $this->addToCart($token, $product, 2)->assertOk();
        $orderRid = $this->placeOrder($token, $this->createAddress($token))->assertCreated()->json('orderId');

        $this->assertSame(3, $product->defaultVariant->fresh()->stock_quantity);

        $this->withToken($token)
            ->postJson("/api/v1/orders/{$orderRid}/cancel", ['reason' => 'Ordered the wrong size'])
            ->assertOk()
            ->assertJsonPath('status', 'cancelled')
            ->assertJsonPath('paymentStatus', 'unpaid');

        $order = Order::query()->where('rid', $orderRid)->firstOrFail();
        $this->assertSame(OrderStatus::Cancelled, $order->status);
        $this->assertSame(5, $product->defaultVariant->fresh()->stock_quantity, 'held stock must return on sale');

        // The customer sees why, in their own words.
        $event = $order->trackingEvents()->orderByDesc('id')->firstOrFail();
        $this->assertSame('Order cancelled', $event->label);
        $this->assertStringContainsString('Ordered the wrong size', (string) $event->description);
    }

    public function test_the_reason_is_optional(): void
    {
        [, $token] = $this->customer();
        $orderRid = $this->unpaidOrder($token);

        $this->withToken($token)
            ->postJson("/api/v1/orders/{$orderRid}/cancel")
            ->assertOk()
            ->assertJsonPath('status', 'cancelled');
    }

    public function test_cancelling_twice_is_the_outcome_the_caller_asked_for(): void
    {
        [, $token] = $this->customer();
        $orderRid = $this->unpaidOrder($token);

        $this->withToken($token)->postJson("/api/v1/orders/{$orderRid}/cancel")->assertOk();

        // A client retrying after a timeout must not be told the request failed.
        $this->withToken($token)
            ->postJson("/api/v1/orders/{$orderRid}/cancel")
            ->assertOk()
            ->assertJsonPath('status', 'cancelled');
    }

    public function test_an_order_with_a_failed_payment_can_still_be_cancelled(): void
    {
        [, $token] = $this->customer();
        $orderRid = $this->unpaidOrder($token);
        Order::query()->where('rid', $orderRid)->update(['payment_status' => OrderPaymentStatus::Failed->value]);

        $this->withToken($token)
            ->postJson("/api/v1/orders/{$orderRid}/cancel")
            ->assertOk()
            ->assertJsonPath('status', 'cancelled');
    }

    public function test_a_paid_order_cannot_be_cancelled_by_the_shopper(): void
    {
        [, $token] = $this->customer();
        $orderRid = $this->paidOrder($token);

        $this->withToken($token)
            ->postJson("/api/v1/orders/{$orderRid}/cancel")
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'order_not_cancellable')
            ->assertJsonPath('error.details.status', 'processing');

        $this->assertSame(OrderStatus::Processing, Order::query()->where('rid', $orderRid)->firstOrFail()->status);
    }

    public function test_a_shipped_order_points_at_the_return_flow_instead(): void
    {
        [, $token] = $this->customer();
        $orderRid = $this->paidOrder($token);
        Order::query()->where('rid', $orderRid)->update([
            'status' => OrderStatus::Shipped->value,
            'shipped_at' => now(),
        ]);

        $this->withToken($token)
            ->postJson("/api/v1/orders/{$orderRid}/cancel")
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'order_not_cancellable');

        // Still a return, which the existing endpoint handles.
        $this->withToken($token)
            ->postJson("/api/v1/orders/{$orderRid}/return", ['reason' => 'Wrong size'])
            ->assertCreated();
    }

    public function test_a_shopper_cannot_cancel_someone_elses_order(): void
    {
        [, $token] = $this->customer();
        $orderRid = $this->unpaidOrder($token);

        [, $otherToken] = $this->customer();

        // The guard caches the resolved user and the container lives across
        // requests in a test, so switching identity needs both reset.
        $this->app['auth']->forgetGuards();
        $this->flushHeaders();

        $this->withToken($otherToken)
            ->postJson("/api/v1/orders/{$orderRid}/cancel")
            ->assertNotFound()
            ->assertJsonPath('error.code', 'order_not_found');

        $this->assertSame(OrderStatus::PendingPayment, Order::query()->where('rid', $orderRid)->firstOrFail()->status);
    }

    public function test_ownership_is_checked_on_the_order_not_only_by_the_lookup(): void
    {
        [$user, $token] = $this->customer();
        $order = $this->orderFor($user);
        $order->update(['status' => OrderStatus::Processing->value, 'payment_status' => OrderPaymentStatus::Paid->value]);

        [, $otherToken] = $this->customer();
        $this->app['auth']->forgetGuards();
        $this->flushHeaders();

        // The service refuses an order that is not the caller's, so a caller
        // that forgets to scope its lookup still cannot cancel a stranger's
        // order. It must not even be told the order exists.
        $this->withToken($otherToken)
            ->postJson('/api/v1/orders/'.$order->rid.'/cancel')
            ->assertNotFound()
            ->assertJsonPath('error.code', 'order_not_found');
    }

    public function test_a_guest_cannot_cancel(): void
    {
        [, $token] = $this->customer();
        $orderRid = $this->unpaidOrder($token);

        // Drop the token the fixture used, so this really is a guest.
        $this->app['auth']->forgetGuards();
        $this->flushHeaders();

        $this->postJson("/api/v1/orders/{$orderRid}/cancel")
            ->assertUnauthorized()
            ->assertJsonPath('error.code', 'unauthenticated');

        $this->assertSame(OrderStatus::PendingPayment, Order::query()->where('rid', $orderRid)->firstOrFail()->status);
    }

    public function test_a_charge_landing_after_a_cancel_is_flagged_rather_than_settling(): void
    {
        [, $token] = $this->customer();
        $orderRid = $this->unpaidOrder($token);
        $order = Order::query()->where('rid', $orderRid)->firstOrFail();

        $this->withToken($token)->postJson("/api/v1/orders/{$orderRid}/cancel")->assertOk();

        // The shopper may have started a payment that settles afterwards.
        $payment = Payment::query()->create([
            'rid' => 'latecharge01',
            'order_id' => $order->id,
            'user_id' => $order->user_id,
            'provider' => 'fake',
            'status' => PaymentStatus::Pending->value,
            'amount_minor' => $order->total_minor,
            'currency_code' => $order->currency_code,
            'external_reference' => 'late-ref-1',
        ]);

        app(PaymentSettlementService::class)->applyVerifiedCharge($payment, new VerifiedCharge(
            externalReference: 'late-ref-1',
            status: 'success',
            paid: true,
            amountMinor: $order->total_minor,
            currencyCode: $order->currency_code,
        ));

        $payment->refresh();
        $order->refresh();
        $this->assertSame(PaymentStatus::NeedsReview->value, $payment->status);
        $this->assertSame(OrderStatus::Cancelled, $order->status, 'the cancellation stands');
        $this->assertNotSame(OrderPaymentStatus::Paid, $order->payment_status);
    }

    private function unpaidOrder(string $token): string
    {
        $product = $this->seedCatalog(stock: 5);
        $this->addToCart($token, $product)->assertOk();

        return $this->placeOrder($token, $this->createAddress($token))->assertCreated()->json('orderId');
    }

    /** An order placed by, and owned by, the given user. */
    private function orderFor(User $user): Order
    {
        $product = $this->seedCatalog(stock: 5);
        $token = $user->createToken('access')->plainTextToken;
        $this->addToCart($token, $product)->assertOk();
        $rid = $this->placeOrder($token, $this->createAddress($token))->assertCreated()->json('orderId');

        return Order::query()->where('rid', $rid)->firstOrFail();
    }

    private function paidOrder(string $token): string
    {
        $product = $this->seedCatalog(stock: 5);
        $this->addToCart($token, $product)->assertOk();
        $orderRid = $this->placeOrder($token, $this->createAddress($token))->assertCreated()->json('orderId');

        $order = Order::query()->where('rid', $orderRid)->firstOrFail();
        $order->update([
            'payment_status' => OrderPaymentStatus::Paid->value,
            'status' => OrderStatus::Processing->value,
        ]);

        return $orderRid;
    }
}
