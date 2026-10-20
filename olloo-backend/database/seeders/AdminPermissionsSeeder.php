<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class AdminPermissionsSeeder extends Seeder
{
    /** @var list<string> */
    public const PERMISSIONS = [
        'view_dashboard',
        'view_products',
        'create_products',
        'edit_products',
        'delete_products',
        'view_categories',
        'create_categories',
        'edit_categories',
        'delete_categories',
        'view_orders',
        'edit_orders',
        'view_payments',
        'recheck_payments',
        'view_webhooks',
        'replay_webhooks',
        'view_customers',
        'view_reviews',
        'edit_reviews',
        'delete_reviews',
        'view_cms',
        'edit_cms',
        'view_placements',
        'edit_placements',
        'view_inquiries',
        'view_newsletter',
        'delete_newsletter',
        'view_staff',
        'create_staff',
        'edit_staff',
        'edit_staff_permissions',
        'edit_staff_passwords',
        'force_staff_password_change',
        'delete_staff',
        'view_request_logs',
        'view_email_logs',
        'manage_notification_settings',
        'manage_shipping_settings',
        'manage_payment_settings',
        'view_countries',
        'sync_countries',
        'manage_tax_settings',
        'manage_currency_settings',
    ];

    public function run(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // Inbox is available to every staff user; drop legacy permission if present.
        Permission::query()
            ->where('name', 'view_notifications')
            ->where('guard_name', 'staff')
            ->delete();

        foreach (self::PERMISSIONS as $permission) {
            Permission::findOrCreate($permission, 'staff');
        }

        $admin = Role::findOrCreate('admin', 'staff');
        $admin->syncPermissions(self::PERMISSIONS);
    }
}
