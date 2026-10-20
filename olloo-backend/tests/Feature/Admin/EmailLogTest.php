<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Enums\EmailLogStatus;
use App\Models\EmailLog;
use App\Models\ExternalRequestLog;
use App\Models\User;
use Database\Seeders\AdminPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

final class EmailLogTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('admin.mfa_forced', false);
        Config::set('mail.default', 'array');
    }

    public function test_outbound_mail_is_logged_with_html_body(): void
    {
        Mail::html('<p>Welcome to HandCO</p>', function ($message): void {
            $message->to('shopper@example.com', 'Shopper')
                ->from('noreply@handco.test', 'HandCO')
                ->subject('Welcome');
        });

        $log = EmailLog::query()->latest('id')->first();
        $this->assertNotNull($log);
        $this->assertSame(EmailLogStatus::Sent, $log->status);
        $this->assertSame('Welcome', $log->subject);
        $this->assertSame('shopper@example.com', $log->to_addresses[0]['address'] ?? null);
        $this->assertStringContainsString('Welcome to HandCO', (string) $log->html_body);
        $this->assertNotEmpty($log->headers);

        $this->assertDatabaseHas('external_request_logs', [
            'action' => 'mail_send',
            'success' => 1,
        ]);

        $requestLog = ExternalRequestLog::query()->where('action', 'mail_send')->latest('id')->first();
        $this->assertNotNull($requestLog);
        $this->assertStringContainsString($log->rid, (string) $requestLog->request_body);
    }

    public function test_brand_logo_is_rewritten_to_open_tracking_url(): void
    {
        $logoUrl = asset('images/brand/handco-logo.png');

        Mail::html(
            '<html><body><img src="'.$logoUrl.'" alt="HandCO"><p>Hello</p></body></html>',
            function ($message): void {
                $message->to('shopper@example.com')
                    ->from('noreply@handco.test')
                    ->subject('Tracked');
            },
        );

        $log = EmailLog::query()->latest('id')->first();
        $this->assertNotNull($log);
        $this->assertStringContainsString('/images/mail/'.$log->rid.'.png', (string) $log->html_body);
        $this->assertStringNotContainsString($logoUrl, (string) $log->html_body);
    }

    public function test_open_tracking_marks_email_log_as_read_and_returns_logo(): void
    {
        $log = EmailLog::query()->create([
            'status' => EmailLogStatus::Sent,
            'mailer' => 'array',
            'subject' => 'Open me',
            'to_addresses' => [['address' => 'a@b.test', 'name' => null]],
            'html_body' => '<html><body>Hi</body></html>',
            'sent_at' => now(),
        ]);

        $this->get(route('mail.brand-asset', ['rid' => $log->rid]))
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png');

        $log->refresh();
        $this->assertNotNull($log->read_at);
        $this->assertSame(1, (int) $log->open_count);
        $this->assertNotNull($log->last_opened_at);
        $this->assertCount(1, $log->open_history ?? []);
        $this->assertArrayHasKey('ip', $log->open_history[0]);
        $this->assertArrayHasKey('user_agent', $log->open_history[0]);
        $this->assertArrayHasKey('opened_at', $log->open_history[0]);

        $this->get(route('mail.brand-asset', ['rid' => $log->rid]))->assertOk();
        $log->refresh();
        $this->assertSame(2, (int) $log->open_count);
        $this->assertCount(2, $log->open_history ?? []);
    }

    public function test_staff_can_view_email_logs_and_html_preview(): void
    {
        $staff = $this->makeStaff();

        $log = EmailLog::query()->create([
            'status' => EmailLogStatus::Sent,
            'mailer' => 'array',
            'subject' => 'Preview me',
            'to_addresses' => [['address' => 'a@b.test', 'name' => null]],
            'html_body' => '<html><body><h1>Invoice</h1></body></html>',
            'text_body' => 'Invoice',
            'sent_at' => now(),
        ]);

        $prefix = trim((string) config('admin.path_prefix'), '/');

        $this->actingAs($staff, 'staff')
            ->get('/'.$prefix.'/email-logs')
            ->assertOk();

        $this->actingAs($staff, 'staff')
            ->get('/'.$prefix.'/email-logs/'.$log->rid)
            ->assertOk();

        $this->actingAs($staff, 'staff')
            ->get('/'.$prefix.'/email-logs/'.$log->rid.'/preview')
            ->assertOk()
            ->assertHeader('Content-Type', 'text/html; charset=UTF-8')
            ->assertSee('Invoice', false);
    }

    public function test_admin_preview_strips_tracking_logo_and_does_not_mark_read(): void
    {
        $staff = $this->makeStaff();
        $rid = 'previewtest01';
        $trackingUrl = url('/images/mail/'.$rid.'.png');

        $log = EmailLog::query()->create([
            'rid' => $rid,
            'status' => EmailLogStatus::Sent,
            'mailer' => 'array',
            'subject' => 'Do not track preview',
            'to_addresses' => [['address' => 'a@b.test', 'name' => null]],
            'html_body' => '<html><body><img src="'.$trackingUrl.'" alt="HandCO"><p>Hello</p></body></html>',
            'sent_at' => now(),
        ]);

        $prefix = trim((string) config('admin.path_prefix'), '/');

        $this->actingAs($staff, 'staff')
            ->get('/'.$prefix.'/email-logs/'.$log->rid.'/preview')
            ->assertOk()
            ->assertDontSee('/images/mail/'.$rid.'.png', false)
            ->assertSee('/images/brand/handco-logo.png', false);

        $log->refresh();
        $this->assertNull($log->read_at);
        $this->assertSame(0, (int) $log->open_count);
        $this->assertSame([], $log->open_history ?? []);
    }

    public function test_staff_session_loading_tracking_logo_does_not_mark_read(): void
    {
        $staff = $this->makeStaff();

        $log = EmailLog::query()->create([
            'status' => EmailLogStatus::Sent,
            'mailer' => 'array',
            'subject' => 'Staff should not open',
            'to_addresses' => [['address' => 'a@b.test', 'name' => null]],
            'html_body' => '<html><body>Hi</body></html>',
            'sent_at' => now(),
        ]);

        $this->actingAs($staff, 'staff')
            ->get(route('mail.brand-asset', ['rid' => $log->rid]))
            ->assertOk();

        $log->refresh();
        $this->assertNull($log->read_at);
        $this->assertSame(0, (int) $log->open_count);
    }

    public function test_staff_without_permission_cannot_view_email_logs(): void
    {
        $staff = User::query()->create([
            'name' => 'Limited Staff',
            'email' => 'limited@handco.test',
            'password' => 'password',
            'user_type' => 'staff',
            'email_verified_at' => now(),
        ]);

        $prefix = trim((string) config('admin.path_prefix'), '/');

        $this->actingAs($staff, 'staff')
            ->get('/'.$prefix.'/email-logs')
            ->assertForbidden();
    }

    private function makeStaff(): User
    {
        $this->seed(AdminPermissionsSeeder::class);

        $staff = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-test@handco.test',
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
