<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Enums\OrderPaymentStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Payments\Contracts\PaymentGateway;
use App\Payments\DTOs\CheckoutRequest;
use App\Payments\DTOs\CheckoutSession;
use App\Payments\DTOs\VerifiedCharge;
use App\Payments\DTOs\WebhookEvent;
use Database\Seeders\AdminPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Queue;
use Tests\Concerns\SeedsCurrencies;
use Tests\TestCase;

/**
 * Staff answering "the customer says they paid". The list has to be findable
 * without knowing a payment rid, and the Check button has to run the same
 * settlement rules a webhook would.
 */
final class PaymentAdminTest extends TestCase
{
    use RefreshDatabase;
    use SeedsCurrencies;

    private string $prefix;

    protected function setUp(): void
    {
        parent::setUp();
        config(['admin.mfa_forced' => false]);
        $this->prefix = trim((string) config('admin.path_prefix'), '/');
    }

    public function test_the_list_is_findable_by_customer_name_email_and_order_number(): void
    {
        $staff = $this->staff();
        $payment = $this->payment();

        $byEmail = $this->actingAs($staff, 'staff')
            ->get($this->url('payments?search='.urlencode($payment->user->email)))
            ->assertOk();
        $this->assertSame([$payment->rid], $this->listedRids($byEmail));

        $byName = $this->actingAs($staff, 'staff')
            ->get($this->url('payments?search='.urlencode($payment->user->name)))
            ->assertOk();
        $this->assertSame([$payment->rid], $this->listedRids($byName));

        $byOrder = $this->actingAs($staff, 'staff')
            ->get($this->url('payments?search='.$payment->order->order_reference))
            ->assertOk();
        $this->assertSame([$payment->rid], $this->listedRids($byOrder));
    }

    public function test_the_summary_counts_every_status_and_totals_money(): void
    {
        $staff = $this->staff();
        $this->payment();
        $this->payment(status: PaymentStatus::NeedsReview, amountMinor: 5000);

        $props = $this->props($this->actingAs($staff, 'staff')->get($this->url('payments'))->assertOk());

        $summary = collect($props['summary'])->keyBy('status');

        $this->assertSame(1, $summary[PaymentStatus::Pending->value]['count']);
        $this->assertSame(1, $summary[PaymentStatus::NeedsReview->value]['count']);
        $this->assertSame(
            [['currency' => 'AED', 'amount' => 50.0]],
            $summary[PaymentStatus::NeedsReview->value]['totals'],
            'Tiles must show real money, not a count alone.',
        );
    }

    public function test_the_summary_never_adds_different_currencies_together(): void
    {
        $staff = $this->staff();
        $this->payment(amountMinor: 10000, currency: 'AED');
        $this->payment(amountMinor: 20000, currency: 'GHS');

        $props = $this->props($this->actingAs($staff, 'staff')->get($this->url('payments'))->assertOk());

        $totals = collect($props['summary'])
            ->firstWhere('status', PaymentStatus::Pending->value)['totals'];

        $this->assertCount(2, $totals);
    }

    public function test_a_needs_review_payment_is_reachable_by_its_status_tab(): void
    {
        $staff = $this->staff();
        $this->payment();
        $review = $this->payment(status: PaymentStatus::NeedsReview);

        $props = $this->props(
            $this->actingAs($staff, 'staff')->get($this->url('payments?status=needs_review'))->assertOk()
        );

        $this->assertSame([$review->rid], collect($props['payments']['data'])->pluck('rid')->all());
    }

    public function test_the_date_range_narrows_the_list(): void
    {
        $staff = $this->staff();
        $this->payment();

        Payment::query()->update(['created_at' => now()->subDays(40), 'updated_at' => now()->subDays(40)]);

        $props = $this->props(
            $this->actingAs($staff, 'staff')->get($this->url('payments?range=30d'))->assertOk()
        );

        $this->assertSame([], collect($props['payments']['data'])->pluck('rid')->all());
        $this->assertSame(
            0,
            collect($props['summary'])->sum('count'),
            'A tile must not count money the chosen range hides.',
        );
    }

    public function test_staff_can_check_a_pending_payment_and_settle_the_order(): void
    {
        Queue::fake();
        $staff = $this->staff();
        $payment = $this->payment(gateway: PaidCharge::class);

        $this->actingAs($staff, 'staff')
            ->from($this->url('payments/'.$payment->rid))
            ->post($this->url('payments/'.$payment->rid.'/recheck'))
            ->assertRedirect($this->url('payments/'.$payment->rid))
            ->assertSessionHas('success');

        $this->assertSame(['cs_admin_1'], PaidCharge::verified());
        $this->assertSame(PaymentStatus::Completed->value, $payment->fresh()?->status);
        $this->assertSame(OrderPaymentStatus::Paid, $payment->fresh()?->order?->payment_status);
    }

    /**
     * A provider charge that does not match the order must still land in
     * needs_review, so the button can never quietly pay the wrong amount.
     */
    public function test_a_mismatched_charge_needs_review_instead_of_paying_the_order(): void
    {
        Queue::fake();
        $staff = $this->staff();
        $payment = $this->payment(gateway: ShortCharge::class);

        $this->actingAs($staff, 'staff')
            ->from($this->url('payments/'.$payment->rid))
            ->post($this->url('payments/'.$payment->rid.'/recheck'))
            ->assertRedirect();

        $this->assertSame(PaymentStatus::NeedsReview->value, $payment->fresh()?->status);
        $this->assertSame(OrderPaymentStatus::Unpaid, $payment->fresh()?->order?->payment_status);
    }

    public function test_a_provider_outage_leaves_the_payment_alone(): void
    {
        Queue::fake();
        $staff = $this->staff();
        $payment = $this->payment(gateway: ExplodingCharge::class);

        $this->actingAs($staff, 'staff')
            ->from($this->url('payments/'.$payment->rid))
            ->post($this->url('payments/'.$payment->rid.'/recheck'))
            ->assertRedirect()
            ->assertSessionHas('error');

        $this->assertSame(PaymentStatus::Pending->value, $payment->fresh()?->status);
    }

    public function test_a_settled_payment_is_not_rechecked(): void
    {
        Queue::fake();
        $staff = $this->staff();
        $payment = $this->payment(status: PaymentStatus::Completed, gateway: PaidCharge::class);

        $this->actingAs($staff, 'staff')
            ->from($this->url('payments/'.$payment->rid))
            ->post($this->url('payments/'.$payment->rid.'/recheck'))
            ->assertRedirect()
            ->assertSessionHas('error');

        $this->assertSame([], PaidCharge::verified());
    }

    public function test_staff_without_the_recheck_permission_cannot_check_payments(): void
    {
        $staff = $this->staff(permissions: ['view_payments']);
        $payment = $this->payment(gateway: PaidCharge::class);

        $this->actingAs($staff, 'staff')
            ->post($this->url('payments/'.$payment->rid.'/recheck'))
            ->assertForbidden();
    }

    public function test_the_detail_page_explains_the_review_and_the_next_step(): void
    {
        $staff = $this->staff();
        $payment = $this->payment(
            status: PaymentStatus::NeedsReview,
            metadata: ['review_reason' => 'Charged 5000 minor units, expected 22890.', 'charged_amount_minor' => 5000, 'charged_currency' => 'AED'],
        );

        $props = $this->props(
            $this->actingAs($staff, 'staff')->get($this->url('payments/'.$payment->rid))->assertOk()
        );

        $this->assertSame('Charged 5000 minor units, expected 22890.', $props['payment']['reviewReason']);
        $this->assertSame(50.0, $props['payment']['chargedAmount']);
        $this->assertSame('AED', $props['payment']['chargedCurrency']);
        $this->assertSame($payment->order->order_reference, $props['payment']['order']['reference']);
    }

    private function url(string $path): string
    {
        return '/'.$this->prefix.'/'.$path;
    }

    /**
     * @param  array<string, mixed>  $response
     * @return list<string>
     */
    private function listedRids($response): array
    {
        return collect($this->props($response)['payments']['data'])->pluck('rid')->values()->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function props($response): array
    {
        return $response->viewData('page')['props'];
    }

    /**
     * @param  list<string>  $permissions
     */
    private function staff(array $permissions = AdminPermissionsSeeder::PERMISSIONS): User
    {
        $this->seed(AdminPermissionsSeeder::class);

        $staff = User::query()->create([
            'name' => 'Cashier',
            'email' => 'payments-admin@handco.test',
            'password' => 'password',
            'user_type' => 'staff',
            'email_verified_at' => now(),
            'must_change_password' => false,
            'two_factor_enabled' => false,
        ]);

        $staff->syncPermissions($permissions);

        return $staff;
    }

    /**
     * @param  class-string<PaymentGateway>  $gateway  What stripe answers with.
     * @param  array<string, mixed>  $metadata
     */
    private function payment(
        string|PaymentStatus $status = PaymentStatus::Pending,
        int $amountMinor = 22890,
        string $currency = 'AED',
        string $gateway = PaidCharge::class,
        array $metadata = [],
    ): Payment {
        $this->seedCurrencies();

        config(['payments.providers.stripe.driver' => $gateway]);
        PaidCharge::reset();
        ShortCharge::reset();
        ExplodingCharge::reset();

        $user = User::factory()->create([
            'name' => 'Amina Yusuf',
            'email' => 'amina.'.Payment::query()->count().'@example.test',
        ]);

        $order = Order::query()->create([
            'order_reference' => 'ORD-FIND'.Payment::query()->count(),
            'user_id' => $user->id,
            'status' => OrderStatus::PendingPayment,
            'payment_status' => OrderPaymentStatus::Unpaid,
            'currency_code' => $currency,
            'items_total_minor' => $amountMinor,
            'items_discount_minor' => 0,
            'shipping_minor' => 0,
            'total_minor' => $amountMinor,
            'placed_at' => now(),
        ]);

        return Payment::query()->create([
            'order_id' => $order->id,
            'user_id' => $user->id,
            'provider' => 'stripe',
            'status' => $status instanceof PaymentStatus ? $status->value : $status,
            'amount_minor' => $amountMinor,
            'currency_code' => $currency,
            'external_reference' => 'cs_admin_1',
            'metadata' => $metadata ?: null,
        ]);
    }
}

abstract class RecheckGateway implements PaymentGateway
{
    /** @var list<string> */
    public static array $verified = [];

    public static function reset(): void
    {
        static::$verified = [];
    }

    public static function verified(): array
    {
        return static::$verified;
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

        return $this->charge();
    }

    abstract protected function charge(): VerifiedCharge;
}

final class PaidCharge extends RecheckGateway
{
    public static function reset(): void
    {
        self::$verified = [];
    }

    public static function verified(): array
    {
        return self::$verified;
    }

    protected function charge(): VerifiedCharge
    {
        return new VerifiedCharge(
            externalReference: 'cs_admin_1',
            status: 'paid',
            paid: true,
            amountMinor: 22890,
            currencyCode: 'AED',
        );
    }
}

final class ShortCharge extends RecheckGateway
{
    public static function reset(): void
    {
        self::$verified = [];
    }

    protected function charge(): VerifiedCharge
    {
        return new VerifiedCharge(
            externalReference: 'cs_admin_1',
            status: 'paid',
            paid: true,
            amountMinor: 5000,
            currencyCode: 'AED',
        );
    }
}

final class ExplodingCharge extends RecheckGateway
{
    public static function reset(): void
    {
        self::$verified = [];
    }

    protected function charge(): VerifiedCharge
    {
        throw new \RuntimeException('Provider is down.');
    }
}
