<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\PermissionRegistrar;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $customer = User::query()->updateOrCreate(
            ['email' => 'demo@handco.test'],
            [
                'name' => 'Demo Customer',
                'display_name' => 'Demo',
                'user_type' => 'customer',
                'password' => 'password',
                'email_verified_at' => now(),
                'is_guest' => false,
                'must_change_password' => false,
                'notify_promotions' => true,
                'notify_order_updates' => true,
            ],
        );

        $customer->syncPermissions([]);

        User::query()->updateOrCreate(
            ['email' => 'jaygrey.jg@gmail.com'],
            [
                'name' => 'Jay Grey',
                'display_name' => 'Jay',
                'user_type' => 'customer',
                'password' => 'password',
                'email_verified_at' => now(),
                'is_guest' => false,
                'must_change_password' => false,
                'notify_promotions' => true,
                'notify_order_updates' => true,
            ],
        );

        $admin = User::query()->updateOrCreate(
            ['email' => 'admin@handco.test'],
            [
                'name' => 'HandCO Admin',
                'display_name' => 'Admin',
                'user_type' => 'staff',
                'password' => 'password',
                'email_verified_at' => now(),
                'is_guest' => false,
                'must_change_password' => false,
                'two_factor_enabled' => false,
                'notify_promotions' => false,
                'notify_order_updates' => true,
            ],
        );

        $this->call(AdminPermissionsSeeder::class);
        $admin->syncPermissions(AdminPermissionsSeeder::PERMISSIONS);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
