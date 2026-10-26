<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Currency\MarkupSettings;
use App\Currency\ShopperLocale;
use App\Models\Country;
use App\Models\Currency;
use App\Models\CurrencyConversion;
use App\Models\ExternalRequestLog;
use App\Models\Order;
use App\Models\Product;
use App\Models\ShippingRule;
use App\Models\User;
use Database\Seeders\GeoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsCheckout;
use Tests\TestCase;

/**
 * Shoppers are priced and charged in their country's currency when it is a
 * configured currency with a fresh rate; otherwise in the default (USD).
 * Fixture: 1 USD = 4 GHS mid, 2% default markup, so USD amounts x 4.08.
 */
final class ShopperCurrencyTest extends TestCase
{
    use BuildsCheckout;
    use RefreshDatabase;

    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->product = $this->seedCatalog(); // 179.00 USD, was 219.00, USD 20.00 flat shipping
        Country::query()->where('code', 'AE')->update(['currency_code' => 'AED']);
        // GH and US already come from seedCatalog; NG is this test's own market,
        // the one with a currency we do not sell in, so it must fall back.
        Country::query()->firstOrCreate(['code' => 'GH'], ['name' => 'Ghana', 'phone_code' => '+233', 'currency_code' => 'GHS']);
        Country::query()->firstOrCreate(['code' => 'NG'], ['name' => 'Nigeria', 'phone_code' => '+234', 'currency_code' => 'NGN']);

        app(MarkupSettings::class)->saveDefaultPercent(2);
        $this->rate('USD', 'GHS', 4.0);
        $this->rate('GHS', 'USD', 0.25);
    }

    public function test_listing_is_priced_in_the_requested_countrys_currency_with_markup(): void
    {
        $item = $this->getJson('/api/v1/products?country=GH')->assertOk()->json('items.0');

        // 179.00 x 4 x 1.02 = 730.32; 219.00 x 4.08 = 893.52
        $this->assertSame(['amount' => 730.32, 'currency' => 'GHS'], $item['priceMoney']);
        $this->assertSame(['amount' => 893.52, 'currency' => 'GHS'], $item['originalPriceMoney']);

        $this->getJson('/api/v1/locale?country=GH')
            ->assertOk()
            ->assertJsonPath('country.code', 'GH')
            ->assertJsonPath('countrySource', 'query')
            ->assertJsonPath('currency.code', 'GHS');
    }

    public function test_a_pair_override_beats_the_default_markup(): void
    {
        CurrencyConversion::query()->where('from_currency_code', 'USD')->where('to_currency_code', 'GHS')->update(['markup_percent' => 5]);

        // 179.00 x 4 x 1.05 = 751.80
        $this->getJson('/api/v1/products?country=GH')->assertOk()->assertJsonPath('items.0.priceMoney.amount', 751.8);
    }

    public function test_unsupported_or_stale_currencies_fall_back_to_the_default(): void
    {
        // NGN is not a configured currency.
        $this->getJson('/api/v1/products?country=NG')->assertOk()->assertJsonPath('items.0.priceMoney', ['amount' => 179, 'currency' => 'USD']);
        $this->getJson('/api/v1/locale?country=NG')->assertOk()->assertJsonPath('country.code', 'NG')->assertJsonPath('currency.code', 'USD');

        // A rate older than 36h is never used.
        CurrencyConversion::query()->update(['fetched_at' => now()->subHours(37)]);
        $this->getJson('/api/v1/products?country=GH')->assertOk()->assertJsonPath('items.0.priceMoney.currency', 'USD');
    }

    public function test_country_is_detected_from_the_ip_once_and_cached(): void
    {
        config(['services.ipinfo.token' => 'test-token']);
        Http::fake(['api.ipinfo.io/*' => Http::response(['ip' => '41.66.0.1', 'country_code' => 'GH'])]);

        foreach (range(1, 2) as $ignored) {
            $this->withServerVariables(['REMOTE_ADDR' => '41.66.0.1'])
                ->getJson('/api/v1/locale')
                ->assertOk()
                ->assertJsonPath('country.code', 'GH')
                ->assertJsonPath('countrySource', 'ip')
                ->assertJsonPath('currency.code', 'GHS');
        }

        Http::assertSentCount(1);
        Http::assertSent(fn (HttpRequest $request) => $request->hasHeader('Authorization', 'Bearer test-token'));
        $log = ExternalRequestLog::query()->where('service', 'ipinfo')->sole();
        $this->assertStringNotContainsString('test-token', json_encode($log->toArray()));
    }

    public function test_without_query_or_ip_the_default_currencys_country_is_used(): void
    {
        // Nothing places this shopper: no query, no stored country, no usable IP.
        // They land on the default currency's own country, which is a real
        // country rather than the null the old currency-derived fallback gave.
        $this->getJson('/api/v1/locale')
            ->assertOk()
            ->assertJsonPath('country.code', 'US')
            ->assertJsonPath('countrySource', 'default')
            ->assertJsonPath('currency.code', 'USD');
    }

    public function test_a_configured_fallback_country_places_unplaceable_shoppers_there(): void
    {
        config(['currency.fallback_country' => 'gh']);

        // Nothing else places this shopper, so the configured market wins over
        // the default currency's country, and its fresh rate prices them in GHS.
        $this->getJson('/api/v1/locale')
            ->assertOk()
            ->assertJsonPath('country.code', 'GH')
            ->assertJsonPath('countrySource', 'default')
            ->assertJsonPath('currency.code', 'GHS');

        // An explicit request still beats the fallback.
        $this->getJson('/api/v1/locale?country=US')
            ->assertOk()
            ->assertJsonPath('currency.code', 'USD');
    }

    public function test_an_unknown_fallback_country_logs_and_uses_the_default_currencys_country(): void
    {
        Log::spy();
        config(['currency.fallback_country' => 'ZZ']);

        $this->getJson('/api/v1/locale')
            ->assertOk()
            ->assertJsonPath('country.code', 'US')
            ->assertJsonPath('currency.code', 'USD');

        Log::shouldHaveReceived('warning')
            ->withArgs(fn (string $message): bool => str_contains($message, 'SHOPPER_FALLBACK_COUNTRY'));
    }

    public function test_the_default_country_is_the_default_currencys_own_country(): void
    {
        // The whole point of currencies.country_code: USD belongs to the US, not
        // to whichever of the 18 USD countries happens to sort first.
        $this->assertSame('US', Currency::query()->where('code', 'USD')->value('country_code'));

        $this->getJson('/api/v1/locale')
            ->assertOk()
            ->assertJsonPath('country.code', 'US')
            ->assertJsonPath('country.name', 'United States')
            ->assertJsonPath('countrySource', 'default');
    }

    public function test_the_default_country_follows_which_currency_is_marked_default(): void
    {
        // Moving the default moves the fallback with it, with no config to keep
        // in step. This is why the currency owns the country.
        Currency::query()->where('code', 'USD')->update(['is_default' => false]);
        Currency::query()->where('code', 'GHS')->update(['is_default' => true]);

        $this->getJson('/api/v1/locale')
            ->assertOk()
            ->assertJsonPath('country.code', 'GH')
            ->assertJsonPath('country.name', 'Ghana')
            ->assertJsonPath('currency.code', 'GHS');
    }

    public function test_a_currency_with_no_country_leaves_unplaceable_shoppers_without_one(): void
    {
        Log::spy();
        Currency::query()->where('code', 'USD')->update(['country_code' => null]);
        $this->app->forgetInstance(ShopperLocale::class);

        // A currency that cannot be placed must still be sellable. Null country
        // turns delivery claims and tax off, which is the honest answer when we
        // cannot place the shopper, and the log says why.
        $this->getJson('/api/v1/locale')
            ->assertOk()
            ->assertJsonPath('country', null)
            ->assertJsonPath('countrySource', 'default')
            ->assertJsonPath('currency.code', 'USD');

        Log::shouldHaveReceived('warning')
            ->withArgs(fn (string $message): bool => str_contains($message, 'country_code'));
    }

    public function test_it_does_not_infer_the_country_from_the_currency(): void
    {
        // Eighteen countries carry USD. Picking the first one put every
        // unplaceable shopper in American Samoa, so the direction is explicit.
        $this->seedCatalog();
        $this->seed(GeoSeeder::class);
        Country::query()->firstOrCreate(['code' => 'AS'], ['name' => 'American Samoa', 'phone_code' => '+1', 'currency_code' => 'USD']);

        $inferred = Country::query()
            ->where('currency_code', 'USD')
            ->orderBy('code')
            ->value('code');

        $resolved = $this->getJson('/api/v1/locale')->assertOk()->json('country.code');

        $this->assertSame('AS', $inferred, 'The old derivation must still resolve to the wrong country, or this test proves nothing.');
        $this->assertSame('US', $resolved, 'A synced countries table must not decide which country an unplaceable shopper is placed in.');
    }

    public function test_order_is_charged_in_the_local_currency_with_an_fx_snapshot(): void
    {
        [$user, $token] = $this->customer();
        $addressRid = $this->createAddress($token, 'GH');

        $cart = $this->withToken($token)
            ->postJson('/api/v1/cart/items?country=GH', ['productId' => $this->product->rid, 'quantity' => 2])
            ->assertOk();
        $cart->assertJsonPath('items.0.priceMoney', ['amount' => 730.32, 'currency' => 'GHS']);
        // 2 x 730.32 + USD 20.00 shipping x 4.08 (81.60)
        $cart->assertJsonPath('summary.subtotal.amount', 1460.64);
        $cart->assertJsonPath('summary.shipping.amount', 81.6);

        $cartItemIds = $this->withToken($token)->getJson('/api/v1/cart?country=GH')->json('items.*.rid');
        $orderRid = $this->withToken($token)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/orders?country=GH', ['addressId' => $addressRid, 'cartItemIds' => $cartItemIds])
            ->assertCreated()
            ->assertJsonPath('totalMoney', ['amount' => 1542.24, 'currency' => 'GHS'])
            ->json('orderId');

        $order = Order::query()->where('rid', $orderRid)->with('items')->sole();
        $this->assertSame('GHS', $order->currency_code);
        $this->assertSame(154224, $order->total_minor);
        $this->assertSame('USD', $order->base_currency_code);
        // Valued back at the GHS -> USD mid rate: 1542.24 x 0.25 = 385.56
        $this->assertSame(38556, $order->base_total_minor);
        $this->assertSame('USD', $order->items[0]->source_currency_code);
        $this->assertSame(17900, $order->items[0]->source_unit_price_minor);
        $this->assertSame(73032, $order->items[0]->unit_price_minor);

        $rates = collect($order->fx_snapshot['rates'])->keyBy(fn (array $rate) => $rate['from'].':'.$rate['to']);
        $this->assertSame('USD', $order->fx_snapshot['baseCurrency']);
        $this->assertEqualsWithDelta(4.0, $rates['USD:GHS']['midRate'], 1e-9);
        $this->assertEqualsWithDelta(2.0, $rates['USD:GHS']['markupPercent'], 1e-9);
        $this->assertEqualsWithDelta(4.08, $rates['USD:GHS']['effectiveRate'], 1e-9);
        $this->assertArrayHasKey('GHS:USD', $rates->all());

        // The gateway is asked for exactly the frozen local total.
        $this->paymentIntent($token, $orderRid)->assertOk()->assertJsonPath('amount', ['amount' => 1542.24, 'currency' => 'GHS']);
        $this->assertSame($user->id, $order->user_id);
    }

    public function test_a_rate_refresh_reprices_the_cart_without_tripping_price_changed(): void
    {
        [, $token] = $this->customer();
        $addressRid = $this->createAddress($token, 'GH');
        $this->withToken($token)->postJson('/api/v1/cart/items?country=GH', ['productId' => $this->product->rid])->assertOk();

        CurrencyConversion::query()->where('from_currency_code', 'USD')->where('to_currency_code', 'GHS')->update(['rate' => 4.5]);

        $cartItemIds = $this->withToken($token)->getJson('/api/v1/cart?country=GH')->json('items.*.rid');
        $this->withToken($token)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/orders?country=GH', ['addressId' => $addressRid, 'cartItemIds' => $cartItemIds])
            ->assertCreated();
    }

    public function test_free_shipping_threshold_in_usd_applies_to_a_ghs_cart(): void
    {
        ShippingRule::query()->create([
            'name' => 'Free over USD 300',
            'strategy' => ShippingRule::STRATEGY_FREE_OVER_THRESHOLD,
            'fee_minor' => 0,
            'currency_code' => 'USD',
            'country' => null,
            'min_subtotal_minor' => 30000,
            'priority' => 1,
            'is_active' => true,
            'transit_days_min' => 2,
            'transit_days_max' => 4,
        ]);
        [, $token] = $this->customer();

        $this->withToken($token)->postJson('/api/v1/cart/items?country=GH', ['productId' => $this->product->rid])
            ->assertOk()
            ->assertJsonPath('summary.shipping.amount', 81.6);

        // Two units are USD 358.00, over the threshold.
        $this->withToken($token)->postJson('/api/v1/cart/items?country=GH', ['productId' => $this->product->rid])
            ->assertOk()
            ->assertJsonPath('summary.shipping.amount', 0);
    }

    public function test_guest_cart_in_another_currency_is_discarded_on_merge(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('access')->plainTextToken;
        $this->withToken($token)->postJson('/api/v1/cart/items', ['productId' => $this->product->rid])->assertOk();
        $this->app['auth']->forgetGuards();

        $other = $this->seedCatalog();
        $guestCartId = $this->withoutToken()
            ->postJson('/api/v1/cart/items?country=GH', ['productId' => $other->rid])
            ->assertOk()
            ->assertJsonPath('items.0.currency', 'GHS')
            ->headers->get('X-Cart-Id');

        $this->withToken($token)
            ->withHeader('X-Cart-Id', $guestCartId)
            ->postJson('/api/v1/cart/merge')
            ->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.productRid', $this->product->rid);

        $this->assertDatabaseMissing('carts', ['rid' => $guestCartId]);
    }

    public function test_price_filters_and_sort_use_the_shoppers_currency(): void
    {
        $cheap = $this->seedCatalog(priceMinor: 5000); // USD 50.00 -> GHS 204.00

        $items = $this->getJson('/api/v1/products?country=GH&minPrice=204&maxPrice=730.32')->assertOk()->json('items');
        $this->assertEqualsCanonicalizing([$this->product->rid, $cheap->rid], array_column($items, 'rid'));

        $items = $this->getJson('/api/v1/products?country=GH&minPrice=205')->assertOk()->json('items');
        $this->assertSame([$this->product->rid], array_column($items, 'rid'));

        $items = $this->getJson('/api/v1/products?country=GH&sort=price_asc')->assertOk()->json('items');
        $this->assertSame([$cheap->rid, $this->product->rid], array_column($items, 'rid'));
    }

    public function test_update_rates_stores_every_pair_and_keeps_markup_overrides(): void
    {
        // A fourth currency proves the base is USD: the EUR rate has to route
        // through the default rather than being fetched pairwise.
        Currency::query()->create(['code' => 'EUR', 'name' => 'Euro', 'payment_provider' => 'fake', 'is_default' => false]);
        CurrencyConversion::query()->where('from_currency_code', 'USD')->where('to_currency_code', 'GHS')->update(['markup_percent' => 3]);
        Http::fake(['open.er-api.com/*' => Http::response(['result' => 'success', 'rates' => ['USD' => 1, 'AED' => 3.67, 'GHS' => 14.8, 'EUR' => 0.9]])]);

        $this->artisan('currency:update-rates')->assertSuccessful();

        // Four currencies is twelve ordered pairs.
        $this->assertSame(12, CurrencyConversion::query()->count());
        $pair = fn (string $from, string $to) => CurrencyConversion::query()->where('from_currency_code', $from)->where('to_currency_code', $to)->sole();
        $this->assertEqualsWithDelta(14.8, (float) $pair('USD', 'GHS')->rate, 1e-9);
        $this->assertEqualsWithDelta(3.0, (float) $pair('USD', 'GHS')->markup_percent, 1e-9);
        // GHS -> EUR crosses the base: 14.8 GHS per USD, 0.9 EUR per USD.
        $this->assertEqualsWithDelta(0.9 / 14.8, (float) $pair('GHS', 'EUR')->rate, 1e-9);
        $this->assertSame('open-er-api', $pair('EUR', 'USD')->source);
        $this->assertTrue(ExternalRequestLog::query()->where('service', 'open-er-api')->exists());
    }

    public function test_update_rates_fails_loudly_and_keeps_old_rates_when_the_provider_errors(): void
    {
        Http::fake(['open.er-api.com/*' => Http::response(['result' => 'error', 'error-type' => 'unsupported-code'])]);

        $this->artisan('currency:update-rates')->assertFailed();

        $this->assertEqualsWithDelta(4.0, (float) CurrencyConversion::query()->where('to_currency_code', 'GHS')->value('rate'), 1e-9);
        $this->assertFalse(ExternalRequestLog::query()->where('service', 'open-er-api')->sole()->success);
    }

    public function test_money_uses_the_currencys_decimal_places(): void
    {
        Currency::query()->create(['code' => 'JPY', 'name' => 'Yen', 'payment_provider' => 'fake', 'decimal_places' => 0, 'is_default' => false]);
        Currency::query()->create(['code' => 'KWD', 'name' => 'Kuwaiti Dinar', 'payment_provider' => 'fake', 'decimal_places' => 3, 'is_default' => false]);

        $this->assertSame(['amount' => 1500, 'currency' => 'JPY'], money(1500, 'JPY'));
        $this->assertSame(['amount' => 1.5, 'currency' => 'KWD'], money(1500, 'KWD'));
    }

    private function rate(string $from, string $to, float $rate): void
    {
        CurrencyConversion::query()->create([
            'from_currency_code' => $from,
            'to_currency_code' => $to,
            'rate' => $rate,
            'fetched_at' => now(),
            'source' => 'test',
        ]);
    }
}
