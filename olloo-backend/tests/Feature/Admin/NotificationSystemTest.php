<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Enums\PaymentStatus;
use App\Jobs\NotifyCustomerOrderPaid;
use App\Jobs\NotifyCustomerOrderShipped;
use App\Jobs\NotifyStaffPaymentReceived;
use App\Mail\InquiryReceivedConfirmationMail;
use App\Mail\OrderPaidMail;
use App\Mail\OrderShippedMail;
use App\Mail\StaffInquiryReceivedMail;
use App\Mail\StaffPaymentReceivedMail;
use App\Models\AppSetting;
use App\Models\Inquiry;
use App\Models\Order;
use App\Models\Payment;
use App\Models\StaffNotification;
use App\Models\User;
use App\Payments\DTOs\VerifiedCharge;
use App\Services\NotificationRecipientSettings;
use App\Services\PaymentSettlementService;
use App\Services\StaffNotificationFanout;
use Database\Seeders\AdminPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Concerns\SeedsCurrencies;
use Tests\TestCase;

final class NotificationSystemTest extends TestCase
{
    use RefreshDatabase;
    use SeedsCurrencies;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedCurrencies();
        config(['admin.mfa_forced' => false]);
        config(['mail.default' => 'array']);
    }

    public function test_notification_settings_save_and_load(): void
    {
        $staff = $this->makeStaff();
        $prefix = trim((string) config('admin.path_prefix'), '/');

        $this->actingAs($staff, 'staff')
            ->put('/'.$prefix.'/settings/notifications', [
                'payment' => ['emails' => 'pay@handco.test, ops@handco.test'],
                'inquiry' => ['emails' => 'hello@handco.test'],
            ])
            ->assertRedirect();

        $settings = app(NotificationRecipientSettings::class);
        $this->assertSame(['pay@handco.test', 'ops@handco.test'], $settings->getEmails('payment'));
        $this->assertSame(['hello@handco.test'], $settings->getEmails('inquiry'));
        $this->assertDatabaseHas('app_settings', [
            'key' => 'notification.payment.emails',
        ]);
    }

    public function test_payment_settlement_notifies_staff_and_customer_once(): void
    {
        Mail::fake();

        AppSetting::query()->create([
            'key' => 'notification.payment.emails',
            'value' => 'admin-notify@handco.test',
        ]);
        app(NotificationRecipientSettings::class)->clearCache();

        $customer = User::query()->create([
            'name' => 'Customer',
            'email' => 'customer@handco.test',
            'password' => 'password',
            'user_type' => 'customer',
            'email_verified_at' => now(),
            'notify_order_updates' => true,
        ]);

        $this->makeStaff();

        $order = Order::query()->create([
            'order_reference' => '#HCOTEST1',
            'user_id' => $customer->id,
            'status' => 'pending_payment',
            'payment_status' => 'unpaid',
            'currency_code' => 'AED',
            'items_total_minor' => 1000,
            'items_discount_minor' => 0,
            'shipping_minor' => 0,
            'total_minor' => 1000,
            'placed_at' => now(),
        ]);

        $payment = Payment::query()->create([
            'order_id' => $order->id,
            'user_id' => $customer->id,
            'provider' => 'fake',
            'status' => PaymentStatus::Pending->value,
            'amount_minor' => 1000,
            'currency_code' => 'AED',
            'external_reference' => 'ref-1',
        ]);

        $charge = new VerifiedCharge(
            externalReference: 'ref-1',
            status: 'completed',
            paid: true,
            amountMinor: 1000,
            currencyCode: 'AED',
        );

        app(PaymentSettlementService::class)->applyVerifiedCharge($payment, $charge);

        Mail::assertSent(StaffPaymentReceivedMail::class, 1);
        Mail::assertSent(OrderPaidMail::class, 1);
        $this->assertSame(1, StaffNotification::query()->where('type', 'payment')->count());

        (new NotifyStaffPaymentReceived($payment->id))->handle(
            app(NotificationRecipientSettings::class),
            app(StaffNotificationFanout::class),
        );
        (new NotifyCustomerOrderPaid($payment->id))->handle();

        Mail::assertSent(StaffPaymentReceivedMail::class, 1);
        Mail::assertSent(OrderPaidMail::class, 1);
    }

    public function test_inquiry_notifies_staff_and_submitter(): void
    {
        Mail::fake();

        AppSetting::query()->create([
            'key' => 'notification.inquiry.emails',
            'value' => 'admin-notify@handco.test',
        ]);
        app(NotificationRecipientSettings::class)->clearCache();
        $this->makeStaff();

        $this->postJson('/api/v1/partnerships/inquiries', [
            'email' => 'partner@example.com',
            'name' => 'Partner Co',
            'message' => 'Hello',
        ])->assertCreated();

        $inquiry = Inquiry::query()->latest('id')->first();
        $this->assertNotNull($inquiry);

        Mail::assertSent(StaffInquiryReceivedMail::class, 1);
        Mail::assertSent(InquiryReceivedConfirmationMail::class, 1);
        $this->assertSame(1, StaffNotification::query()->where('type', 'inquiry')->count());
    }

    public function test_order_shipped_sends_customer_mail_once(): void
    {
        Mail::fake();
        $staff = $this->makeStaff();

        $customer = User::query()->create([
            'name' => 'Buyer',
            'email' => 'buyer@handco.test',
            'password' => 'password',
            'user_type' => 'customer',
            'email_verified_at' => now(),
            'notify_order_updates' => true,
        ]);

        $order = Order::query()->create([
            'order_reference' => '#HCOSHIP1',
            'user_id' => $customer->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'currency_code' => 'AED',
            'items_total_minor' => 500,
            'items_discount_minor' => 0,
            'shipping_minor' => 0,
            'total_minor' => 500,
            'placed_at' => now(),
            'shipping_snapshot' => [],
        ]);

        $prefix = trim((string) config('admin.path_prefix'), '/');

        $this->actingAs($staff, 'staff')
            ->put('/'.$prefix.'/orders/'.$order->rid.'/status', ['status' => 'shipped'])
            ->assertRedirect();

        Mail::assertSent(OrderShippedMail::class, 1);

        (new NotifyCustomerOrderShipped($order->id))->handle();
        Mail::assertSent(OrderShippedMail::class, 1);
    }

    public function test_staff_can_bulk_mark_notifications_read_and_unread(): void
    {
        $staff = $this->makeStaff();
        $prefix = trim((string) config('admin.path_prefix'), '/');

        $one = StaffNotification::query()->create([
            'user_id' => $staff->id,
            'type' => 'payment',
            'title' => 'One',
            'message' => 'Msg',
            'data' => [],
        ]);
        $two = StaffNotification::query()->create([
            'user_id' => $staff->id,
            'type' => 'inquiry',
            'title' => 'Two',
            'message' => 'Msg',
            'data' => [],
        ]);

        $this->actingAs($staff, 'staff')
            ->post('/'.$prefix.'/notifications/bulk', [
                'rids' => [$one->rid, $two->rid],
                'action' => 'read',
            ])
            ->assertRedirect();

        $this->assertNotNull($one->fresh()->read_at);
        $this->assertNotNull($two->fresh()->read_at);

        $this->actingAs($staff, 'staff')
            ->post('/'.$prefix.'/notifications/bulk', [
                'rids' => [$one->rid],
                'action' => 'unread',
            ])
            ->assertRedirect();

        $this->assertNull($one->fresh()->read_at);

        $this->actingAs($staff, 'staff')
            ->post('/'.$prefix.'/notifications/mark-all-read')
            ->assertRedirect();

        $this->assertNotNull($one->fresh()->read_at);
    }

    private function makeStaff(): User
    {
        $this->seed(AdminPermissionsSeeder::class);

        $staff = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-notify@handco.test',
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
