<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Currency\ShopperLocale;
use App\Models\Country;
use App\Models\CurrencyConversion;
use App\Models\Product;
use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsCheckout;
use Tests\TestCase;

/**
 * A signed-in shopper's stored country beats their current IP, so their
 * currency does not change because they travelled. The order is:
 * ?country=, then preferred_country, then assigned_country, then IP.
 *
 * Fixture: 1 USD = 4 GHS mid, so a GHS shopper sees 4x the USD price.
 */
final class ShopperCountryPreferenceTest extends TestCase
{
    use BuildsCheckout;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedCatalog(); // creates USD (default), AED and GHS
        Country::query()->where('code', 'AE')->update(['currency_code' => 'AED']);
        // Kenya's own currency is not one we sell in, so it falls back to USD.
        Country::query()->firstOrCreate(['code' => 'KE'], ['name' => 'Kenya', 'phone_code' => '+254', 'currency_code' => 'KES']);

        // Every pair we sell into, so a country in any of them is reachable and
        // a change of country shows up as a change of currency.
        foreach ([
            ['USD', 'GHS', 4.0],
            ['GHS', 'USD', 0.25],
            ['USD', 'AED', 3.6725],
            ['AED', 'USD', 0.2723],
        ] as [$from, $to, $rate]) {
            CurrencyConversion::query()->create([
                'from_currency_code' => $from,
                'to_currency_code' => $to,
                'rate' => $rate,
                'fetched_at' => now(),
                'source' => 'test',
            ]);
        }

        // This visitor looks like they are in Kenya from every IP.
        config(['services.ipinfo.token' => 'test-token']);
        Http::fake(['api.ipinfo.io/*' => Http::response(['country_code' => 'KE'])]);
    }

    public function test_a_preferred_country_beats_the_assigned_country_and_the_ip(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('access')->plainTextToken;
        UserSetting::put($user->id, UserSetting::ASSIGNED_COUNTRY, 'AE');
        UserSetting::put($user->id, UserSetting::PREFERRED_COUNTRY, 'GH');

        // IP says Kenya, assigned says UAE, preferred says Ghana.
        $this->withToken($token)
            ->getJson('/api/v1/locale')
            ->assertOk()
            ->assertJsonPath('country.code', 'GH')
            ->assertJsonPath('countrySource', 'preferred')
            ->assertJsonPath('currency.code', 'GHS');

        // And prices follow it, without a ?country= on the call.
        $this->withToken($token)
            ->getJson('/api/v1/products?limit=1')
            ->assertOk()
            ->assertJsonPath('items.0.priceMoney.currency', 'GHS');
    }

    public function test_the_assigned_country_beats_the_ip(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('access')->plainTextToken;
        UserSetting::put($user->id, UserSetting::ASSIGNED_COUNTRY, 'GH');

        $this->withToken($token)
            ->getJson('/api/v1/locale')
            ->assertOk()
            ->assertJsonPath('country.code', 'GH')
            ->assertJsonPath('countrySource', 'assigned');
    }

    public function test_a_query_param_still_beats_everything(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('access')->plainTextToken;
        UserSetting::put($user->id, UserSetting::ASSIGNED_COUNTRY, 'AE');
        UserSetting::put($user->id, UserSetting::PREFERRED_COUNTRY, 'GH');

        $this->withToken($token)
            ->getJson('/api/v1/locale?country=AE')
            ->assertOk()
            ->assertJsonPath('country.code', 'AE')
            ->assertJsonPath('countrySource', 'query');
    }

    public function test_a_guest_is_still_placed_by_ip_and_is_never_stored(): void
    {
        // A routable address, or the geo lookup skips a loopback IP.
        $this->withServerVariables(['REMOTE_ADDR' => '41.66.0.1'])
            ->getJson('/api/v1/locale')
            ->assertOk()
            ->assertJsonPath('country.code', 'KE')
            ->assertJsonPath('countrySource', 'ip');

        // A guest has no account to hang a setting on.
        $this->assertSame(0, UserSetting::query()->count());
    }

    public function test_the_first_seen_ip_is_assigned_once_and_then_left_alone(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('access')->plainTextToken;

        $this->withServerVariables(['REMOTE_ADDR' => '41.66.0.1'])
            ->withToken($token)
            ->getJson('/api/v1/locale')
            ->assertOk();
        $this->assertSame('KE', UserSetting::valueFor($user->id, UserSetting::ASSIGNED_COUNTRY));

        // They travel. The stored country holds, so their price does not jump.
        Http::fake(['api.ipinfo.com/*' => Http::response(['country_code' => 'GH'])]);
        $this->app['auth']->forgetGuards();

        $this->withServerVariables(['REMOTE_ADDR' => '41.66.0.1'])
            ->withToken($token)
            ->getJson('/api/v1/locale')
            ->assertOk()
            ->assertJsonPath('country.code', 'KE')
            ->assertJsonPath('countrySource', 'assigned');
    }

    public function test_a_stored_country_we_do_not_know_is_ignored(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('access')->plainTextToken;
        UserSetting::put($user->id, UserSetting::PREFERRED_COUNTRY, 'ZZ');
        UserSetting::put($user->id, UserSetting::ASSIGNED_COUNTRY, 'GH');

        // Falls through to the assigned country rather than failing.
        $this->withToken($token)
            ->getJson('/api/v1/locale')
            ->assertOk()
            ->assertJsonPath('country.code', 'GH')
            ->assertJsonPath('countrySource', 'assigned');
    }

    public function test_a_shopper_sets_and_clears_their_preferred_country(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('access')->plainTextToken;
        UserSetting::put($user->id, UserSetting::ASSIGNED_COUNTRY, 'AE');

        $this->withToken($token)
            ->putJson('/api/v1/users/me/country', ['preferredCountry' => 'GH'])
            ->assertOk()
            ->assertJsonPath('country.code', 'GH')
            ->assertJsonPath('countrySource', 'preferred')
            ->assertJsonPath('currency.code', 'GHS');

        $this->assertSame('GH', UserSetting::valueFor($user->id, UserSetting::PREFERRED_COUNTRY));

        // Clearing it puts them back on the assigned country.
        $this->withToken($token)
            ->putJson('/api/v1/users/me/country', ['preferredCountry' => null])
            ->assertOk()
            ->assertJsonPath('country.code', 'AE')
            ->assertJsonPath('countrySource', 'assigned');

        $this->assertNull(UserSetting::valueFor($user->id, UserSetting::PREFERRED_COUNTRY));
    }

    public function test_the_endpoint_accepts_a_name_or_rid_as_well_as_a_code(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('access')->plainTextToken;
        $ghana = Country::query()->where('code', 'GH')->firstOrFail();

        $this->withToken($token)
            ->putJson('/api/v1/users/me/country', ['preferredCountry' => 'Ghana'])
            ->assertOk()
            ->assertJsonPath('country.code', 'GH');

        $this->withToken($token)
            ->putJson('/api/v1/users/me/country', ['preferredCountry' => $ghana->rid])
            ->assertOk()
            ->assertJsonPath('country.code', 'GH');
    }

    public function test_the_endpoint_refuses_an_unknown_country(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('access')->plainTextToken;

        $this->withToken($token)
            ->putJson('/api/v1/users/me/country', ['preferredCountry' => 'ZZ'])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'country_not_found');

        $this->assertNull(UserSetting::valueFor($user->id, UserSetting::PREFERRED_COUNTRY));
    }

    public function test_the_endpoint_requires_the_field_and_authentication(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('access')->plainTextToken;

        // Validation comes back in the error envelope, not Laravel's own errors key.
        $this->withToken($token)
            ->putJson('/api/v1/users/me/country', [])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'validation_error')
            ->assertJsonStructure(['error' => ['details' => ['preferredCountry']]]);

        // Drop the token the first request set, so this really is a guest.
        $this->app['auth']->forgetGuards();
        $this->flushHeaders();

        $this->putJson('/api/v1/users/me/country', ['preferredCountry' => 'GH'])
            ->assertUnauthorized();

        $this->assertSame(0, UserSetting::query()->count());
    }

    public function test_a_preferred_country_changes_the_currency_a_cart_is_charged_in(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('access')->plainTextToken;
        UserSetting::put($user->id, UserSetting::ASSIGNED_COUNTRY, 'AE');

        $product = Product::query()->firstOrFail();
        $addressRid = $this->createAddress($token, 'GH');

        $this->withToken($token)
            ->postJson('/api/v1/cart/items', ['productId' => $product->rid])
            ->assertOk()
            ->assertJsonPath('items.0.currency', 'AED');

        $this->withToken($token)
            ->putJson('/api/v1/users/me/country', ['preferredCountry' => 'GH'])
            ->assertOk();

        // Same cart, no ?country= anywhere: now priced in the shopper's currency.
        $this->withToken($token)
            ->getJson('/api/v1/cart')
            ->assertOk()
            ->assertJsonPath('summary.total.currency', 'GHS');

        $itemRid = $this->withToken($token)->getJson('/api/v1/cart')->json('items.0.rid');
        $this->withToken($token)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/orders', [
                'addressId' => $addressRid,
                'cartItemIds' => [$itemRid],
            ])
            ->assertCreated()
            ->assertJsonPath('totalMoney.currency', 'GHS');
    }

    public function test_the_locale_source_enum_is_stable_for_clients(): void
    {
        $this->assertSame(
            ['query', 'preferred', 'assigned', 'ip', 'default'],
            [ShopperLocale::SOURCE_QUERY, ShopperLocale::SOURCE_PREFERRED, ShopperLocale::SOURCE_ASSIGNED, ShopperLocale::SOURCE_IP, ShopperLocale::SOURCE_DEFAULT],
        );
    }

    public function test_the_stored_country_is_the_iso_code_not_the_name(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('access')->plainTextToken;

        $this->withToken($token)->putJson('/api/v1/users/me/country', ['preferredCountry' => 'Ghana'])->assertOk();

        // So a later lookup by code finds it even if the country is renamed.
        $this->assertSame('GH', UserSetting::valueFor($user->id, UserSetting::PREFERRED_COUNTRY));
    }

    public function test_the_ip_is_not_consulted_once_a_country_is_stored(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('access')->plainTextToken;
        UserSetting::put($user->id, UserSetting::PREFERRED_COUNTRY, 'GH');

        Http::fake(['api.ipinfo.io/*' => Http::response(['country_code' => 'KE'])]);

        $this->withToken($token)->getJson('/api/v1/locale')->assertOk();

        // Not one request: we already know where this shopper wants to shop.
        Http::assertNotSent(fn (HttpRequest $request) => str_contains($request->url(), 'ipinfo'));
    }
}
