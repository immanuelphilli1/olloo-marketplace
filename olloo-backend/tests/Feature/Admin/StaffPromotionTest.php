<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Http\Middleware\HandleInertiaRequests;
use App\Models\User;
use App\Services\AuthTokenService;
use Database\Seeders\AdminPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

final class StaffPromotionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['admin.mfa_forced' => false, 'inertia.testing.ensure_pages_exist' => false]);
        $this->seed(AdminPermissionsSeeder::class);
    }

    private function url(string $path): string
    {
        return '/'.trim((string) config('admin.path_prefix'), '/').'/'.$path;
    }

    private function makeStaff(array $permissions = AdminPermissionsSeeder::PERMISSIONS): User
    {
        $staff = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-staff@handco.test',
            'password' => 'password',
            'user_type' => 'staff',
            'email_verified_at' => now(),
            'must_change_password' => false,
            'two_factor_enabled' => false,
        ]);
        $staff->syncPermissions($permissions);

        return $staff;
    }

    private function makeCustomer(): User
    {
        return User::query()->create([
            'name' => 'Thomas',
            'email' => 'thomas@example.com',
            'password' => 'customer-password',
            'user_type' => 'customer',
        ]);
    }

    public function test_create_page_searches_customers_on_partial_reload(): void
    {
        $customer = $this->makeCustomer();

        $this->actingAs($this->makeStaff(), 'staff')
            ->get($this->url('staff/create?customer_search=thomas'), [
                'X-Inertia' => 'true',
                'X-Inertia-Partial-Component' => 'Admin/Staff/Create',
                'X-Inertia-Partial-Data' => 'customers',
                'X-Inertia-Version' => (string) app(HandleInertiaRequests::class)->version(request()),
            ])
            ->assertOk()
            ->assertJsonPath('props.customers.0.rid', $customer->rid)
            ->assertJsonPath('props.customers.0.email', 'thomas@example.com');
    }

    public function test_first_visit_does_not_load_customers(): void
    {
        $this->makeCustomer();

        $this->actingAs($this->makeStaff(), 'staff')
            ->get($this->url('staff/create?customer_search=thomas'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Staff/Create')
                ->missing('customers')
                ->where('canPromoteCustomers', true));
    }

    public function test_promoted_customer_keeps_their_shop_login_and_password(): void
    {
        $customer = $this->makeCustomer();
        app(AuthTokenService::class)->issueTokens($customer);

        $this->actingAs($this->makeStaff(), 'staff')
            ->post($this->url('staff'), [
                'customer' => $customer->rid,
                'permissions' => ['view_orders'],
            ])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $customer->refresh();
        $this->assertSame('staff', $customer->user_type);
        $this->assertSame('Thomas', $customer->name);
        $this->assertTrue($customer->can('view_orders'));
        $this->assertSame(1, $customer->tokens()->count());
        $this->assertSame(1, User::query()->where('email', 'thomas@example.com')->count());

        $this->postJson('/api/v1/auth/login', [
            'email' => 'thomas@example.com',
            'password' => 'customer-password',
        ])->assertOk()->assertJsonStructure(['accessToken']);

        $this->postJson('/api/v1/auth/check-email', ['email' => 'thomas@example.com'])
            ->assertOk()
            ->assertJsonPath('exists', true);
    }

    public function test_google_only_customer_needs_a_password_to_be_promoted(): void
    {
        $customer = User::query()->create([
            'name' => 'Ada',
            'email' => 'ada@example.com',
            'password' => null,
            'user_type' => 'customer',
            'oauth_provider' => 'google',
            'oauth_provider_id' => 'g-1',
        ]);

        $this->actingAs($this->makeStaff(), 'staff')
            ->post($this->url('staff'), ['customer' => $customer->rid])
            ->assertSessionHasErrors('password');

        $this->assertSame('customer', $customer->refresh()->user_type);
    }

    public function test_rejects_a_rid_that_is_not_a_customer(): void
    {
        $staff = $this->makeStaff();

        $this->actingAs($staff, 'staff')
            ->post($this->url('staff'), [
                'customer' => $staff->rid,
                'password' => 'staff-password',
                'password_confirmation' => 'staff-password',
            ])
            ->assertSessionHasErrors('customer');
    }

    public function test_promotion_needs_view_customers(): void
    {
        $customer = $this->makeCustomer();
        $staff = $this->makeStaff(array_values(array_diff(AdminPermissionsSeeder::PERMISSIONS, ['view_customers'])));

        $this->actingAs($staff, 'staff')
            ->post($this->url('staff'), [
                'customer' => $customer->rid,
                'password' => 'staff-password',
                'password_confirmation' => 'staff-password',
            ])
            ->assertSessionHasErrors('customer');

        $this->assertSame('customer', $customer->refresh()->user_type);
    }

    public function test_new_account_still_requires_a_free_email(): void
    {
        $this->makeCustomer();

        $this->actingAs($this->makeStaff(), 'staff')
            ->post($this->url('staff'), [
                'name' => 'Thomas',
                'email' => 'thomas@example.com',
                'password' => 'staff-password',
                'password_confirmation' => 'staff-password',
            ])
            ->assertSessionHasErrors('email');
    }
}
