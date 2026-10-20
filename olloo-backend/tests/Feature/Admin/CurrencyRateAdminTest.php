<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Currency\MarkupSettings;
use App\Models\CurrencyConversion;
use App\Models\User;
use Database\Seeders\AdminPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\SeedsCurrencies;
use Tests\TestCase;

final class CurrencyRateAdminTest extends TestCase
{
    use RefreshDatabase;
    use SeedsCurrencies;

    private string $prefix;

    protected function setUp(): void
    {
        parent::setUp();
        config(['admin.mfa_forced' => false, 'inertia.testing.ensure_pages_exist' => false]);
        $this->prefix = '/'.trim((string) config('admin.path_prefix'), '/');
        $this->seedCurrencies();
    }

    public function test_staff_see_rates_and_set_default_and_pair_markups(): void
    {
        $staff = $this->staff();
        $pair = CurrencyConversion::query()->create([
            'from_currency_code' => 'AED',
            'to_currency_code' => 'GHS',
            'rate' => 4,
            'fetched_at' => now()->subHours(40),
            'source' => 'test',
        ]);

        $this->actingAs($staff, 'staff')
            ->put($this->prefix.'/settings/currencies/markup', ['default_markup_percent' => 1.5])
            ->assertSessionHasNoErrors();
        $this->assertSame(1.5, app(MarkupSettings::class)->defaultPercent());

        $this->actingAs($staff, 'staff')
            ->get($this->prefix.'/settings/currencies')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Settings/Currencies/Index')
                ->where('defaultMarkupPercent', 1.5)
                ->where('pairs.0.rid', $pair->rid)
                ->where('pairs.0.markupOverride', null)
                ->where('pairs.0.isStale', true)
                ->where('pairs.0.effectiveRate', 4.06)
            );

        $this->actingAs($staff, 'staff')
            ->put($this->prefix.'/settings/currencies/pairs/'.$pair->rid, ['markup_percent' => 3])
            ->assertSessionHasNoErrors();
        $this->assertEqualsWithDelta(3.0, (float) $pair->fresh()->markup_percent, 1e-9);

        // Clearing the override goes back to the default.
        $this->actingAs($staff, 'staff')
            ->put($this->prefix.'/settings/currencies/pairs/'.$pair->rid, ['markup_percent' => null])
            ->assertSessionHasNoErrors();
        $this->assertNull($pair->fresh()->markup_percent);

        $this->actingAs($staff, 'staff')
            ->put($this->prefix.'/settings/currencies/markup', ['default_markup_percent' => -1])
            ->assertSessionHasErrors('default_markup_percent');
    }

    public function test_refresh_fetches_rates_and_reports_unsupported_currencies(): void
    {
        // The provider answers for USD and GHS but not AED, which is the currency we
        // do sell in that has no rate, so staff must be told rather than left
        // with a silently AED-priced shop.
        Http::fake(['open.er-api.com/*' => Http::response(['result' => 'success', 'rates' => ['USD' => 1, 'GHS' => 12.4]])]);

        $this->actingAs($this->staff(), 'staff')
            ->post($this->prefix.'/settings/currencies/refresh')
            ->assertSessionHas('error', fn (string $message) => str_contains($message, 'AED'));

        // Only the pairs the provider could answer for.
        $this->assertSame(2, CurrencyConversion::query()->count());
    }

    public function test_staff_without_permission_are_refused(): void
    {
        $staff = $this->staff();
        $staff->revokePermissionTo('manage_currency_settings');

        $this->actingAs($staff, 'staff')->get($this->prefix.'/settings/currencies')->assertForbidden();
        $this->actingAs($staff, 'staff')->post($this->prefix.'/settings/currencies/refresh')->assertForbidden();
    }

    private function staff(): User
    {
        $this->seed(AdminPermissionsSeeder::class);

        $staff = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-currencies@handco.test',
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
