<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\User;
use Database\Seeders\AdminPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

final class UploadTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_can_upload_a_product_image_to_storage(): void
    {
        config(['admin.mfa_forced' => false]);
        Storage::fake('public');
        $this->seed(AdminPermissionsSeeder::class);
        $staff = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-upload@handco.test',
            'password' => 'password',
            'user_type' => 'staff',
            'email_verified_at' => now(),
            'must_change_password' => false,
            'two_factor_enabled' => false,
        ]);
        $staff->syncPermissions(['create_products']);
        $prefix = trim((string) config('admin.path_prefix'), '/');

        $response = $this->actingAs($staff, 'staff')->postJson('/'.$prefix.'/uploads', [
            'image' => UploadedFile::fake()->image('cover.jpg'),
            'folder' => 'products',
        ]);

        $response->assertCreated()->assertJsonPath('path', fn (string $path) => str_starts_with($path, '/storage/uploads/products/'));
        Storage::disk('public')->assertExists(str_replace('/storage/', '', $response->json('path')));
    }

    public function test_staff_can_upload_a_payment_method_icon(): void
    {
        config(['admin.mfa_forced' => false]);
        Storage::fake('public');
        $this->seed(AdminPermissionsSeeder::class);
        $staff = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-upload-4@handco.test',
            'password' => 'password',
            'user_type' => 'staff',
            'email_verified_at' => now(),
            'must_change_password' => false,
            'two_factor_enabled' => false,
        ]);
        $staff->syncPermissions(['create_products']);
        $prefix = trim((string) config('admin.path_prefix'), '/');

        $this->actingAs($staff, 'staff')->postJson('/'.$prefix.'/uploads', [
            'image' => UploadedFile::fake()->image('tabby.png'),
            'folder' => 'payment-methods',
        ])->assertCreated()->assertJsonPath('path', fn (string $path) => str_starts_with($path, '/storage/uploads/payment-methods/'));
    }

    public function test_banner_editors_can_upload_a_banner_image(): void
    {
        config(['admin.mfa_forced' => false]);
        Storage::fake('public');
        $this->seed(AdminPermissionsSeeder::class);
        $staff = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-banner-upload@handco.test',
            'password' => 'password',
            'user_type' => 'staff',
            'email_verified_at' => now(),
            'must_change_password' => false,
            'two_factor_enabled' => false,
        ]);
        $staff->syncPermissions(['edit_placements']);
        $prefix = trim((string) config('admin.path_prefix'), '/');

        $this->actingAs($staff, 'staff')->postJson('/'.$prefix.'/uploads', [
            'image' => UploadedFile::fake()->image('hero.jpg', 2400, 640),
            'folder' => 'placements',
        ])->assertCreated()->assertJsonPath('path', fn (string $path) => str_starts_with($path, '/storage/uploads/placements/'));
    }

    public function test_upload_rejects_non_images_and_unknown_folders(): void
    {
        config(['admin.mfa_forced' => false]);
        Storage::fake('public');
        $this->seed(AdminPermissionsSeeder::class);
        $staff = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-upload-2@handco.test',
            'password' => 'password',
            'user_type' => 'staff',
            'email_verified_at' => now(),
            'must_change_password' => false,
            'two_factor_enabled' => false,
        ]);
        $staff->syncPermissions(['edit_products']);
        $prefix = trim((string) config('admin.path_prefix'), '/');

        $this->actingAs($staff, 'staff')->postJson('/'.$prefix.'/uploads', [
            'image' => UploadedFile::fake()->create('notes.txt', 10, 'text/plain'),
        ])->assertUnprocessable();

        $this->actingAs($staff, 'staff')->postJson('/'.$prefix.'/uploads', [
            'image' => UploadedFile::fake()->image('cover.jpg'),
            'folder' => '../../env',
        ])->assertUnprocessable();
    }

    public function test_staff_without_catalog_permission_cannot_upload(): void
    {
        config(['admin.mfa_forced' => false]);
        Storage::fake('public');
        $this->seed(AdminPermissionsSeeder::class);
        $staff = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-upload-3@handco.test',
            'password' => 'password',
            'user_type' => 'staff',
            'email_verified_at' => now(),
            'must_change_password' => false,
            'two_factor_enabled' => false,
        ]);
        $staff->syncPermissions(['view_orders']);
        $prefix = trim((string) config('admin.path_prefix'), '/');

        $this->actingAs($staff, 'staff')->postJson('/'.$prefix.'/uploads', [
            'image' => UploadedFile::fake()->image('cover.jpg'),
        ])->assertForbidden();
    }
}
