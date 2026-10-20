<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Jobs\SyncCountriesJob;
use App\Models\Country;
use App\Models\ExternalRequestLog;
use App\Models\User;
use Database\Seeders\AdminPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

final class CountrySyncTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'admin.mfa_forced' => false,
            'inertia.testing.ensure_pages_exist' => false,
            'services.restcountries.api_key' => 'test-key',
            'services.restcountries.base_url' => 'https://api.restcountries.test/countries/v5',
        ]);
    }

    public function test_sync_creates_and_updates_countries_across_pages(): void
    {
        $existing = Country::query()->create(['code' => 'AE', 'name' => 'UAE', 'phone_code' => '+971']);

        Http::fake([
            'api.restcountries.test/*offset=0*' => Http::response($this->page([
                $this->country('AE', 'United Arab Emirates', 'ARE', ['971'], 'AED', 'Asia'),
            ], more: true)),
            'api.restcountries.test/*offset=100*' => Http::response($this->page([
                $this->country('GH', 'Ghana', 'GHA', ['233'], 'GHS', 'Africa'),
                ['codes' => ['alpha_2' => ''], 'names' => ['common' => 'Broken']],
            ])),
        ]);

        $this->artisan('countries:sync')
            ->expectsOutputToContain('Created: 1, updated: 1')
            ->assertSuccessful();

        $existing->refresh();
        $this->assertSame('United Arab Emirates', $existing->name);
        $this->assertSame('ARE', $existing->alpha3);
        $this->assertSame('AED', $existing->currency_code);
        $this->assertNotNull($existing->synced_at);

        $ghana = Country::query()->where('code', 'GH')->firstOrFail();
        $this->assertSame('+233', $ghana->phone_code);
        $this->assertSame('Africa', $ghana->region);
        $this->assertSame(2, Country::query()->count());

        Http::assertSent(fn ($request) => $request->hasHeader('Authorization', 'Bearer test-key'));
        $this->assertSame(2, ExternalRequestLog::query()->where('service', 'restcountries')->count());
    }

    public function test_sync_fails_loudly_without_api_key(): void
    {
        config(['services.restcountries.api_key' => null]);
        Http::fake();

        $this->artisan('countries:sync')->assertFailed();
        Http::assertNothingSent();
    }

    public function test_sync_rejects_the_demo_key_and_logs_failed_requests(): void
    {
        Http::fake([
            'api.restcountries.test/*' => Http::sequence()
                ->push(['data' => ['objects' => [], '_demo' => true]])
                ->push('nope', 500),
        ]);

        $this->artisan('countries:sync')->expectsOutputToContain('demo key')->assertFailed();
        $this->artisan('countries:sync')->expectsOutputToContain('(500)')->assertFailed();

        $this->assertSame(2, ExternalRequestLog::query()->where('service', 'restcountries')->count());
        $this->assertSame(0, Country::query()->count());
    }

    public function test_admin_lists_countries_and_queues_sync(): void
    {
        Queue::fake();
        $staff = $this->staff();
        $prefix = trim((string) config('admin.path_prefix'), '/');
        $ghana = Country::query()->create(['code' => 'GH', 'name' => 'Ghana']);
        Country::query()->create(['code' => 'AE', 'name' => 'United Arab Emirates']);

        $this->actingAs($staff, 'staff')
            ->get('/'.$prefix.'/countries?search=gh&search_by=code')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Countries/Index')
                ->where('countries.total', 1)
                ->where('countries.data.0.rid', $ghana->rid)
                ->where('syncConfigured', true)
                ->where('canSync', true)
            );

        $this->actingAs($staff, 'staff')
            ->get('/'.$prefix.'/countries/'.$ghana->rid)
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/Countries/Show')->where('country.code', 'GH'));

        $this->actingAs($staff, 'staff')
            ->post('/'.$prefix.'/countries/sync')
            ->assertRedirect('/'.$prefix.'/countries');

        Queue::assertPushed(SyncCountriesJob::class);
    }

    public function test_sync_is_refused_without_permission_or_api_key(): void
    {
        Queue::fake();
        $staff = $this->staff();
        $prefix = trim((string) config('admin.path_prefix'), '/');

        $staff->revokePermissionTo('sync_countries');
        $this->actingAs($staff, 'staff')->post('/'.$prefix.'/countries/sync')->assertForbidden();

        $staff->givePermissionTo('sync_countries');
        config(['services.restcountries.api_key' => '']);
        $this->actingAs($staff, 'staff')->post('/'.$prefix.'/countries/sync')->assertSessionHas('error');

        Queue::assertNothingPushed();
    }

    /**
     * @param  list<array<string, mixed>>  $objects
     * @return array<string, mixed>
     */
    private function page(array $objects, bool $more = false): array
    {
        return ['data' => ['objects' => $objects, 'meta' => ['more' => $more]]];
    }

    /**
     * @param  list<string>  $callingCodes
     * @return array<string, mixed>
     */
    private function country(string $alpha2, string $name, string $alpha3, array $callingCodes, string $currency, string $region): array
    {
        return [
            'names' => ['common' => $name],
            'codes' => ['alpha_2' => $alpha2, 'alpha_3' => $alpha3],
            'flag' => ['emoji' => '🏳'],
            'calling_codes' => $callingCodes,
            'currencies' => [['code' => $currency]],
            'region' => $region,
        ];
    }

    private function staff(): User
    {
        $this->seed(AdminPermissionsSeeder::class);

        $staff = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-countries@handco.test',
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
