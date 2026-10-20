<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\User;
use Database\Seeders\AdminPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

final class ProductIndexTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_list_gets_the_storefront_url_for_view_in_shop(): void
    {
        config(['admin.mfa_forced' => false, 'services.storefront.url' => 'https://shop.test/']);
        $this->seed(AdminPermissionsSeeder::class);
        $staff = User::query()->create([
            'name' => 'Admin',
            'email' => 'list@handco.test',
            'password' => 'password',
            'user_type' => 'staff',
            'email_verified_at' => now(),
            'must_change_password' => false,
            'two_factor_enabled' => false,
        ]);
        $staff->syncPermissions(['view_products']);

        $this->actingAs($staff, 'staff')
            ->get('/'.trim((string) config('admin.path_prefix'), '/').'/products')
            ->assertOk()
            // Trailing slash trimmed, so the page builds <url>/products/<rid>.
            ->assertInertia(fn (AssertableInertia $page) => $page->where('storefrontUrl', 'https://shop.test'));
    }
}
