<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Currency;
use App\Models\ShippingClass;
use App\Models\ShippingRule;
use App\Models\User;
use App\Services\ShippingService;
use App\Shipping\ShippingLine;
use Database\Seeders\AdminPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class ShippingRuleAdminTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['admin.mfa_forced' => false]);
        Currency::query()->create([
            'code' => 'AED',
            'name' => 'UAE Dirham',
            'payment_provider' => 'fake',
            'is_default' => true,
        ]);
    }

    private function prefix(): string
    {
        return trim((string) config('admin.path_prefix'), '/');
    }

    private function makeStaff(bool $withPermission = true): User
    {
        $this->seed(AdminPermissionsSeeder::class);

        $staff = User::query()->create([
            'name' => 'Admin',
            'email' => $withPermission ? 'admin-ship@handco.test' : 'norights@handco.test',
            'password' => 'password',
            'user_type' => 'staff',
            'email_verified_at' => now(),
            'must_change_password' => false,
            'two_factor_enabled' => false,
        ]);

        $staff->syncPermissions($withPermission ? AdminPermissionsSeeder::PERMISSIONS : []);

        return $staff;
    }

    private function rulePayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'UAE standard',
            'strategy' => 'flat',
            'fee' => '20.00',
            'currency_code' => 'AED',
            'country' => 'AE',
            'priority' => 10,
            'is_active' => true,
            'transit_days_min' => 1,
            'transit_days_max' => 3,
        ], $overrides);
    }

    public function test_index_requires_permission(): void
    {
        $staff = $this->makeStaff(false);

        $this->actingAs($staff, 'staff')
            ->get('/'.$this->prefix().'/settings/shipping')
            ->assertForbidden();

        $this->actingAs($this->makeStaff())
            ->get('/'.$this->prefix().'/settings/shipping')
            ->assertOk();
    }

    public function test_store_creates_rule(): void
    {
        $staff = $this->makeStaff();

        $this->actingAs($staff, 'staff')
            ->post('/'.$this->prefix().'/settings/shipping', $this->rulePayload())
            ->assertRedirect();

        $this->assertDatabaseHas('shipping_rules', [
            'name' => 'UAE standard',
            'fee_minor' => 2000,
            'currency_code' => 'AED',
            'country' => 'AE',
        ]);
    }

    public function test_store_rejects_threshold_on_flat(): void
    {
        $staff = $this->makeStaff();

        $this->actingAs($staff, 'staff')
            ->post('/'.$this->prefix().'/settings/shipping', $this->rulePayload([
                'threshold' => '100.00',
            ]))
            ->assertSessionHasErrors('threshold');
    }

    public function test_store_rejects_nonzero_fee_on_threshold_strategy(): void
    {
        $staff = $this->makeStaff();

        $this->actingAs($staff, 'staff')
            ->post('/'.$this->prefix().'/settings/shipping', $this->rulePayload([
                'strategy' => 'free_over_threshold',
                'fee' => '5.00',
                'threshold' => '500.00',
            ]))
            ->assertSessionHasErrors('fee');

        $this->actingAs($staff, 'staff')
            ->post('/'.$this->prefix().'/settings/shipping', $this->rulePayload([
                'strategy' => 'free_over_threshold',
                'fee' => '5.00',
            ]))
            ->assertSessionHasErrors(['threshold', 'fee']);
    }

    public function test_store_rejects_unknown_currency(): void
    {
        $staff = $this->makeStaff();

        $this->actingAs($staff, 'staff')
            ->post('/'.$this->prefix().'/settings/shipping', $this->rulePayload([
                'currency_code' => 'ZZZ',
            ]))
            ->assertSessionHasErrors('currency_code');
    }

    public function test_destroy_last_active_rule_refused(): void
    {
        $staff = $this->makeStaff();
        $rule = ShippingRule::query()->create([
            'name' => 'Only rule',
            'strategy' => 'flat',
            'fee_minor' => 2000,
            'currency_code' => 'AED',
            'country' => null,
            'min_subtotal_minor' => null,
            'priority' => 100,
            'is_active' => true,
            'transit_days_min' => 2,
            'transit_days_max' => 4,
        ]);

        $this->actingAs($staff, 'staff')
            ->delete('/'.$this->prefix().'/settings/shipping/'.$rule->rid)
            ->assertSessionHasErrors('rule');

        $this->assertDatabaseHas('shipping_rules', ['rid' => $rule->rid]);

        ShippingRule::query()->create([
            'name' => 'Second rule',
            'strategy' => 'flat',
            'fee_minor' => 1000,
            'currency_code' => 'AED',
            'country' => null,
            'min_subtotal_minor' => null,
            'priority' => 50,
            'is_active' => true,
            'transit_days_min' => 2,
            'transit_days_max' => 4,
        ]);

        $this->actingAs($staff, 'staff')
            ->delete('/'.$this->prefix().'/settings/shipping/'.$rule->rid)
            ->assertRedirect();

        $this->assertDatabaseMissing('shipping_rules', ['rid' => $rule->rid]);
    }

    public function test_toggle_last_active_rule_refused(): void
    {
        $staff = $this->makeStaff();
        $rule = ShippingRule::query()->create([
            'name' => 'Only rule',
            'strategy' => 'flat',
            'fee_minor' => 2000,
            'currency_code' => 'AED',
            'country' => null,
            'min_subtotal_minor' => null,
            'priority' => 100,
            'is_active' => true,
            'transit_days_min' => 2,
            'transit_days_max' => 4,
        ]);

        $this->actingAs($staff, 'staff')
            ->post('/'.$this->prefix().'/settings/shipping/'.$rule->rid.'/toggle')
            ->assertSessionHasErrors('rule');

        $this->assertTrue($rule->fresh()->is_active);
    }

    public function test_quote_endpoint_matches_and_misses(): void
    {
        $staff = $this->makeStaff();
        ShippingRule::query()->create([
            'name' => 'UAE free over 500',
            'strategy' => 'free_over_threshold',
            'fee_minor' => 0,
            'currency_code' => 'AED',
            'country' => 'AE',
            'min_subtotal_minor' => 50000,
            'priority' => 10,
            'is_active' => true,
            'transit_days_min' => 2,
            'transit_days_max' => 4,
        ]);

        $hit = $this->actingAs($staff, 'staff')
            ->getJson('/'.$this->prefix().'/settings/shipping/test-quote?country=AE&currency=AED&subtotal=600')
            ->assertOk();

        $hit->assertJsonPath('matchedRule.name', 'UAE free over 500')
            ->assertJsonPath('fee', '0.00');

        $miss = $this->actingAs($staff, 'staff')
            ->getJson('/'.$this->prefix().'/settings/shipping/test-quote?country=US&currency=AED&subtotal=600')
            ->assertOk();

        $miss->assertJsonPath('matchedRule', null)
            ->assertJsonPath('fee', null);
    }

    public function test_storefront_quote_reflects_portal_change(): void
    {
        $staff = $this->makeStaff();

        $this->actingAs($staff, 'staff')
            ->post('/'.$this->prefix().'/settings/shipping', $this->rulePayload([
                'name' => 'Portal rule',
                'country' => null,
                'fee' => '15.00',
            ]))
            ->assertRedirect();

        $quote = app(ShippingService::class)->quoteLines('AED', null, [new ShippingLine(1000, null, 1)]);

        $this->assertSame(1500, $quote['feeMinor']);
        $this->assertSame(['min' => 2, 'max' => 4], $quote['deliveryDays']);
    }

    public function test_rule_needs_a_sensible_transit_range_and_can_target_a_class(): void
    {
        $staff = $this->makeStaff();
        $bulky = ShippingClass::query()->create(['name' => 'Bulky']);

        $this->actingAs($staff, 'staff')
            ->post('/'.$this->prefix().'/settings/shipping', $this->rulePayload(['transit_days_min' => 5, 'transit_days_max' => 2]))
            ->assertSessionHasErrors('transit_days_max');

        $this->actingAs($staff, 'staff')
            ->post('/'.$this->prefix().'/settings/shipping', $this->rulePayload([
                'name' => 'Bulky UAE',
                'shipping_class_rid' => $bulky->rid,
                'transit_days_min' => 5,
                'transit_days_max' => 9,
            ]))
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('shipping_rules', [
            'name' => 'Bulky UAE',
            'shipping_class_id' => $bulky->id,
            'transit_days_min' => 5,
            'transit_days_max' => 9,
        ]);
    }

    public function test_shipping_classes_can_be_managed_but_not_deleted_while_used(): void
    {
        $staff = $this->makeStaff();
        $base = '/'.$this->prefix().'/settings/shipping-classes';

        $this->actingAs($staff, 'staff')->post($base, ['name' => 'Bulky'])->assertSessionHasNoErrors();
        $this->actingAs($staff, 'staff')->post($base, ['name' => 'Bulky'])->assertSessionHasErrors('name');

        $bulky = ShippingClass::query()->where('name', 'Bulky')->firstOrFail();
        $this->actingAs($staff, 'staff')->put($base.'/'.$bulky->rid, ['name' => 'Oversized'])->assertSessionHasNoErrors();
        $this->assertSame('Oversized', $bulky->refresh()->name);

        ShippingRule::query()->create([
            'name' => 'Oversized rule',
            'strategy' => ShippingRule::STRATEGY_FLAT,
            'fee_minor' => 10000,
            'currency_code' => 'AED',
            'shipping_class_id' => $bulky->id,
            'priority' => 1,
            'is_active' => true,
            'transit_days_min' => 5,
            'transit_days_max' => 9,
        ]);

        $this->actingAs($staff, 'staff')->delete($base.'/'.$bulky->rid)->assertSessionHas('error');
        $this->assertModelExists($bulky);
    }
}
