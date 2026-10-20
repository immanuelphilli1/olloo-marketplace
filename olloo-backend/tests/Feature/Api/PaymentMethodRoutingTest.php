<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Jobs\AuthoriseAndCaptureTamaraOrder;
use App\Jobs\CapturePaypalOrder;
use App\Jobs\CaptureTabbyPayment;
use App\Models\Address;
use App\Models\Country;
use App\Models\Currency;
use App\Models\CurrencyConversion;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\PaymentWebhookEvent;
use App\Models\User;
use App\Models\UserSetting;
use App\Services\PaymentMethodResolver;
use App\Services\PaymentSettlementService;
use Database\Seeders\AdminPermissionsSeeder;
use Database\Seeders\PaymentMethodSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\BuildsCheckout;
use Tests\Concerns\SeedsCurrencies;
use Tests\TestCase;

final class PaymentMethodRoutingTest extends TestCase
{
    use BuildsCheckout;
    use RefreshDatabase;
    use SeedsCurrencies;

    public function test_payment_intent_routes_by_method_plus_currency(): void
    {
        $this->seedCurrencies();
        $product = $this->seedCatalog();
        PaymentMethod::query()->create([
            'code' => 'card', 'label' => 'Card', 'provider' => 'fake',
            'currencies' => ['USD'], 'is_active' => true,
        ]);
        [$user, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $orderRid = $this->placeOrder($token, $this->createAddress($token))->assertCreated()->json('orderId');

        $this->paymentIntent($token, $orderRid)
            ->assertOk()
            ->assertJsonPath('provider', 'fake')
            ->assertJsonPath('paymentMethodId', null);

        $payment = Payment::query()->firstOrFail();
        $this->assertSame('fake', $payment->provider);
        $this->assertNull($payment->payment_method_id);
    }

    public function test_payment_intent_with_a_method_stores_it_and_uses_its_provider(): void
    {
        $this->seedCurrencies();
        $product = $this->seedCatalog();
        $method = PaymentMethod::query()->create([
            'code' => 'card', 'label' => 'Card', 'provider' => 'fake',
            'currencies' => ['USD'], 'is_active' => true,
        ]);
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $orderRid = $this->placeOrder($token, $this->createAddress($token))->assertCreated()->json('orderId');

        $this->withToken($token)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/checkout/payment-intent', ['orderId' => $orderRid, 'paymentMethodId' => $method->rid])
            ->assertOk()
            ->assertJsonPath('provider', 'fake')
            ->assertJsonPath('paymentMethodId', $method->rid);

        $this->assertSame($method->id, Payment::query()->firstOrFail()->payment_method_id);
    }

    public function test_payment_intent_rejects_unknown_and_unavailable_methods(): void
    {
        $this->seedCurrencies();
        $product = $this->seedCatalog();
        PaymentMethod::query()->create([
            'code' => 'momo', 'label' => 'MoMo', 'provider' => 'fake',
            'currencies' => ['GHS'], 'is_active' => true,
        ]);
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $orderRid = $this->placeOrder($token, $this->createAddress($token))->assertCreated()->json('orderId');

        $intent = fn (string $methodRef) => $this->withToken($token)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/checkout/payment-intent', ['orderId' => $orderRid, 'paymentMethodId' => $methodRef]);

        $intent('nope')->assertNotFound()->assertJsonPath('error.code', 'payment_method_not_found');
        $intent('momo')->assertStatus(422)->assertJsonPath('error.code', 'payment_method_unavailable');
    }

    public function test_checkout_options_filter_by_currency_and_country(): void
    {
        $this->seedCurrencies();
        $this->seedCatalog();
        $this->givenCountries(['GH', 'AE']);
        PaymentMethod::query()->create([
            'code' => 'card', 'label' => 'Card', 'provider' => 'fake',
            'currencies' => ['USD'], 'is_active' => true,
        ]);
        PaymentMethod::query()->create([
            'code' => 'momo', 'label' => 'MoMo', 'provider' => 'fake',
            'currencies' => ['GHS'], 'countries' => ['GH'], 'is_active' => true,
        ]);
        PaymentMethod::query()->create([
            'code' => 'off', 'label' => 'Off', 'provider' => 'fake',
            'currencies' => ['USD'], 'is_active' => false,
        ]);

        $this->getJson('/api/v1/payment-methods/checkout?currency=USD')
            ->assertOk()
            ->assertJsonPath('paymentMethods.0.code', 'card')
            ->assertJsonCount(1, 'paymentMethods');

        $this->getJson('/api/v1/payment-methods/checkout?currency=GHS&country=GH')
            ->assertJsonPath('paymentMethods.0.code', 'momo');

        $this->getJson('/api/v1/payment-methods/checkout?currency=GHS&country=AE')
            ->assertJsonCount(0, 'paymentMethods');
    }

    /**
     * The seeded three-market fixture: USD/AED/GHS, each scoped to its own
     * countries, so a resolution that picks the wrong market is visible.
     */
    public function test_checkout_options_resolve_currency_and_country_when_neither_is_sent(): void
    {
        $this->seedCurrencies();
        Country::query()->firstOrCreate(['code' => 'AE'], ['name' => 'United Arab Emirates', 'phone_code' => '+971', 'currency_code' => 'AED']);
        Country::query()->firstOrCreate(['code' => 'GH'], ['name' => 'Ghana', 'phone_code' => '+233', 'currency_code' => 'GHS']);
        $this->seed(PaymentMethodSeeder::class);
        $this->givenRates();

        $user = User::factory()->create();
        $token = $user->createToken('access')->plainTextToken;

        // No params at all. The currency is the store default, so only the USD
        // rows come back, and never the GHS or AED ones.
        $this->assertSame(
            ['usd_cards', 'apple_pay', 'google_pay'],
            $this->methodCodes($this->getJson('/api/v1/payment-methods/checkout')),
        );

        // The shopper's preferred country picks the currency, still no params.
        UserSetting::put($user->id, UserSetting::PREFERRED_COUNTRY, 'GH');
        $this->app['auth']->forgetGuards();
        $this->assertSame(
            ['ghs_cards', 'mobile_money'],
            $this->methodCodes($this->withToken($token)->getJson('/api/v1/payment-methods/checkout')),
        );

        // Their default address is Ghana too, so nothing is ruled out by country.
        $this->createAddress($token, 'GH');
        $this->app['auth']->forgetGuards();
        $this->assertSame(
            ['ghs_cards', 'mobile_money'],
            $this->methodCodes($this->withToken($token)->getJson('/api/v1/payment-methods/checkout')),
        );

        // Their address moves to the UAE while they still pay in GHS. The address
        // is the shipping question and must not narrow the payment list, so the
        // Ghana methods stay: a Paystack card pays an order shipping to Dubai
        // perfectly well, and an empty list here dead-ends checkout.
        $this->createAddress($token, 'AE');
        $this->app['auth']->forgetGuards();
        $this->assertSame(
            ['ghs_cards', 'mobile_money'],
            $this->methodCodes($this->withToken($token)->getJson('/api/v1/payment-methods/checkout')),
        );
    }

    public function test_checkout_options_prefer_an_explicit_param_over_the_resolved_market(): void
    {
        $this->seedCurrencies();
        Country::query()->firstOrCreate(['code' => 'AE'], ['name' => 'United Arab Emirates', 'phone_code' => '+971', 'currency_code' => 'AED']);
        Country::query()->firstOrCreate(['code' => 'GH'], ['name' => 'Ghana', 'phone_code' => '+233', 'currency_code' => 'GHS']);
        $this->seed(PaymentMethodSeeder::class);

        // A stored preferred country of Ghana, overridden to the AED market.
        $user = User::factory()->create();
        $token = $user->createToken('access')->plainTextToken;
        UserSetting::put($user->id, UserSetting::PREFERRED_COUNTRY, 'GH');
        $this->createAddress($token, 'GH');
        $this->app['auth']->forgetGuards();

        $this->assertSame(
            ['aed_cards', 'aed_apple_pay', 'aed_google_pay'],
            $this->methodCodes($this->withToken($token)->getJson('/api/v1/payment-methods/checkout?currency=AED&country=AE')),
        );
    }

    public function test_checkout_options_reject_an_unknown_country_instead_of_widening_the_list(): void
    {
        $this->seedCurrencies();
        $this->seedCatalog();
        PaymentMethod::query()->create([
            'code' => 'card', 'label' => 'Card', 'provider' => 'fake',
            'currencies' => ['USD'], 'is_active' => true,
        ]);

        // Previously this resolved to "destination unknown" and skipped the
        // country filter, so a typo returned everything.
        $this->getJson('/api/v1/payment-methods/checkout?currency=USD&country=ZZ')
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'country_not_found');
    }

    /**
     * @return list<string>
     */
    private function methodCodes(TestResponse $response): array
    {
        $response->assertOk();

        return collect($response->json('paymentMethods'))->pluck('code')->all();
    }

    public function test_approved_webhooks_dispatch_provider_follow_ups(): void
    {
        Queue::fake();
        $this->seedCurrencies();
        config([
            'payments.providers.paypal.client_id' => 'cid',
            'payments.providers.paypal.secret' => 'csec',
            'payments.providers.paypal.webhook_id' => 'WH-1',
            'payments.providers.tabby.secret_key' => 'sk_test_x',
            'payments.providers.tabby.merchant_code' => 'M1',
            'payments.providers.tamara.api_token' => 'tok',
            'payments.providers.tamara.notification_token' => 'ntok',
        ]);
        Http::fake([
            '*/v1/oauth2/token' => Http::response(['access_token' => 'tok'], 200),
            '*/v2/checkout/orders/PP-1' => Http::response(['id' => 'PP-1', 'status' => 'APPROVED'], 200),
            '*/api/v1/payments/TB-1' => Http::response([
                'id' => 'TB-1', 'status' => 'AUTHORIZED', 'amount' => '179.00', 'currency' => 'AED',
            ], 200),
            '*/orders/TM-1' => Http::response(['order_id' => 'TM-1', 'status' => 'approved'], 200),
        ]);

        $settle = function (string $provider, string $eventType, string $reference, string $external): void {
            $payment = Payment::query()->create([
                'provider' => $provider,
                'status' => 'pending',
                'amount_minor' => 17900,
                'currency_code' => 'AED',
                'external_reference' => $external,
            ]);
            $event = PaymentWebhookEvent::query()->create([
                'provider' => $provider,
                'external_event_id' => $provider.':'.$external.':'.$eventType,
                'event_type' => $eventType,
                'payload' => ['reference' => $payment->rid, 'paid' => false, 'event_type' => $eventType, 'raw' => []],
            ]);

            app(PaymentSettlementService::class)->processWebhookEvent($event);
        };

        $settle('paypal', 'CHECKOUT.ORDER.APPROVED', 'PP-1', 'PP-1');
        Queue::assertPushed(CapturePaypalOrder::class);

        $settle('tabby', 'payment_authorized', 'TB-1', 'TB-1');
        Queue::assertPushed(CaptureTabbyPayment::class);

        $settle('tamara', 'order_approved', 'TM-1', 'TM-1');
        Queue::assertPushed(AuthoriseAndCaptureTamaraOrder::class);
    }

    public function test_icon_url_resolves_paths_but_not_artwork_keys(): void
    {
        $this->seedCurrencies();
        $this->givenCountries(['AE']);
        $this->seed(PaymentMethodSeeder::class);

        $methods = $this->getJson('/api/v1/payment-methods/checkout?currency=AED&country=AE')
            ->assertOk()
            ->json('paymentMethods');

        $byCode = collect($methods)->keyBy('code');
        foreach (['aed_cards', 'aed_apple_pay', 'aed_google_pay'] as $code) {
            $icon = (string) $byCode[$code]['icon'];
            $this->assertStringStartsWith('/images/payment-methods/', $icon);
            $this->assertTrue(
                is_file(public_path(ltrim($icon, '/'))),
                "Missing artwork file for {$code}: {$icon}",
            );
            $this->assertStringEndsWith($icon, (string) $byCode[$code]['iconUrl']);
        }

        // Staff uploads (anything with a slash) survive reseeds untouched.
        PaymentMethod::query()->where('code', 'aed_cards')->update(['icon' => '/storage/uploads/payment-methods/custom.png']);
        $this->seed(PaymentMethodSeeder::class);
        $this->assertSame('/storage/uploads/payment-methods/custom.png', PaymentMethod::query()->where('code', 'aed_cards')->value('icon'));
    }

    public function test_legacy_artwork_keys_migrate_to_seeded_badges(): void
    {
        $this->seedCurrencies();
        PaymentMethod::query()->create([
            'code' => 'aed_cards', 'label' => 'Card', 'provider' => 'fake', 'icon' => 'card',
            'currencies' => ['USD'], 'is_active' => true,
        ]);

        $this->seed(PaymentMethodSeeder::class);

        $this->assertSame('/images/payment-methods/card.svg', PaymentMethod::query()->where('code', 'aed_cards')->value('icon'));
    }

    /**
     * UAE rides on Stripe, Ghana on Paystack. A cart must only ever be offered
     * methods its currency (and destination) settles with, so a GHS cart can
     * never reach a Stripe method and blow up at Paystack initialize time.
     */
    public function test_seeded_methods_split_by_currency_and_country(): void
    {
        $this->seedCurrencies();
        Country::query()->firstOrCreate(['code' => 'AE'], ['name' => 'United Arab Emirates', 'phone_code' => '+971']);
        Country::query()->firstOrCreate(['code' => 'GH'], ['name' => 'Ghana', 'phone_code' => '+233']);
        // Every other country is a USD shopper, and the USD rows must serve them.
        Country::query()->firstOrCreate(['code' => 'NG'], ['name' => 'Nigeria', 'phone_code' => '+234']);
        $this->seed(PaymentMethodSeeder::class);

        $aed = $this->getJson('/api/v1/payment-methods/checkout?currency=AED&country=AE')
            ->assertOk()
            ->json('paymentMethods');
        $this->assertSame(
            ['aed_cards', 'aed_apple_pay', 'aed_google_pay'],
            collect($aed)->pluck('code')->all(),
        );
        foreach ($aed as $method) {
            $this->assertSame('stripe', $this->providerFor($method['rid']));
        }

        $ghs = $this->getJson('/api/v1/payment-methods/checkout?currency=GHS&country=GH')
            ->assertOk()
            ->json('paymentMethods');
        $this->assertSame(
            ['ghs_cards', 'mobile_money'],
            collect($ghs)->pluck('code')->all(),
        );
        foreach ($ghs as $method) {
            $this->assertSame('paystack', $this->providerFor($method['rid']));
        }

        // The USD market, which is the fallback for everywhere else, carries its own
        // rows with no country list so a dollar shopper anywhere can pay.
        $usd = $this->getJson('/api/v1/payment-methods/checkout?currency=USD&country=NG')
            ->assertOk()
            ->json('paymentMethods');
        $this->assertSame(
            ['usd_cards', 'apple_pay', 'google_pay'],
            collect($usd)->pluck('code')->all(),
        );

        // Nothing scoped to the wrong market. A GHS cart in an AE market gets nothing:
        // the Stripe rows are USD-only and the Paystack rows are GH-only, and
        // falling back would mean charging GHS on the wrong gateway.
        $this->getJson('/api/v1/payment-methods/checkout?currency=GHS&country=AE')
            ->assertOk()
            ->assertJsonCount(0, 'paymentMethods');
        $this->getJson('/api/v1/payment-methods/checkout?currency=AED&country=GH')
            ->assertOk()
            ->assertJsonCount(0, 'paymentMethods');

        // Nothing global is left: every active method is scoped to one currency.
        $this->assertSame(0, PaymentMethod::query()
            ->where('is_active', true)
            ->where(fn ($q) => $q->whereNull('currencies')->orWhere('currencies', '[]'))
            ->count());

        // And the three USD rows are the only ones open to every country.
        foreach ($usd as $method) {
            $this->assertSame([], PaymentMethod::query()->where('code', $method['code'])->sole()->countryList());
        }
    }

    public function test_retiring_the_legacy_card_row_keeps_it_for_history(): void
    {
        $this->seedCurrencies();
        $this->givenCountries(['GH']);
        PaymentMethod::query()->create([
            'code' => 'card', 'label' => 'Card', 'provider' => 'paystack',
            'currencies' => ['GHS'], 'countries' => ['GH'], 'is_active' => true,
        ]);

        $this->seed(PaymentMethodSeeder::class);

        $legacy = PaymentMethod::query()->where('code', 'card')->first();
        $this->assertNotNull($legacy, 'The legacy row should be retired, not deleted.');
        $this->assertFalse($legacy->is_active);

        $this->getJson('/api/v1/payment-methods/checkout?currency=GHS&country=GH')
            ->assertOk()
            ->assertJsonPath('paymentMethods.0.code', 'ghs_cards');
    }

    /**
     * The countries a test filters on.
     *
     * The `country` param is resolved against the `countries` table and an
     * unknown code is a 422, so a test passing `country=AE` needs the AE row to
     * exist. Treating a missing row as "destination unknown" here would hide
     * typos in the filter, which is the whole point of the check.
     *
     * @param  list<string>  $codes
     */
    private function givenCountries(array $codes): void
    {
        foreach ($codes as $code) {
            Country::query()->firstOrCreate(
                ['code' => $code],
                ['name' => $code, 'phone_code' => '+000'],
            );
        }
    }

    /**
     * Live rates both ways for the three markets.
     *
     * `ShopperLocale` only leaves the default currency when it can actually
     * convert, so without these a GHS or AE shopper is silently priced in USD
     * and the market filter never runs.
     */
    private function givenRates(): void
    {
        foreach ([['USD', 'GHS', 4.0], ['GHS', 'USD', 0.25], ['USD', 'AED', 3.6725], ['AED', 'USD', 0.2723]] as [$from, $to, $rate]) {
            CurrencyConversion::query()->create([
                'from_currency_code' => $from,
                'to_currency_code' => $to,
                'rate' => $rate,
                'fetched_at' => now(),
                'source' => 'test',
            ]);
        }
    }

    private function providerFor(string $rid): string
    {
        return (string) PaymentMethod::query()->where('rid', $rid)->value('provider');
    }

    /**
     * firstOrCreate alone would let a live method keep pointing at a gateway
     * that cannot carry its currency, which is how an AED method ended up on
     * Paystack and failed at checkout. Reseeding re-asserts routing on live
     * rows, keeps staff display edits, and leaves parked rows alone.
     */
    public function test_reseeding_corrects_routing_but_keeps_staff_edits(): void
    {
        $this->seedCurrencies();
        PaymentMethod::query()->create([
            'code' => 'aed_cards', 'label' => 'Debit or credit card', 'provider' => 'paystack',
            'icon' => '/images/payment-methods/card.svg', 'currencies' => ['AED'], 'countries' => null,
            'sort_order' => 9, 'is_active' => true, 'is_fallback' => true,
        ]);
        PaymentMethod::query()->create([
            'code' => 'tabby', 'label' => 'Tabby (trialling)', 'provider' => 'stripe',
            'currencies' => ['USD'], 'countries' => ['US'], 'sort_order' => 3, 'is_active' => false, 'is_fallback' => true,
        ]);

        $this->seed(PaymentMethodSeeder::class);

        $live = PaymentMethod::query()->where('code', 'aed_cards')->firstOrFail();
        $this->assertSame('stripe', $live->provider, 'A live method must not keep a gateway that cannot carry AED.');
        $this->assertSame(['AED'], $live->currencyList());
        $this->assertSame(['AE'], $live->countryList());
        $this->assertFalse($live->is_fallback, 'A market-scoped row must not stay a fallback.');
        // Staff presentation edits survive.
        $this->assertSame('Debit or credit card', $live->label);
        $this->assertSame(9, $live->sort_order);

        $parked = PaymentMethod::query()->where('code', 'tabby')->firstOrFail();
        $this->assertSame('Tabby (trialling)', $parked->label);
        $this->assertSame('stripe', $parked->provider, 'An inactive method keeps whatever staff were trialling.');
        $this->assertSame(['USD'], $parked->currencyList());
        $this->assertTrue($parked->is_fallback, 'An inactive method keeps whatever staff were trialling.');
    }

    /**
     * The bug this guards: a cart priced in AED for a shopper whose market was
     * read as Ghana returned an empty method list and checkout could not
     * continue. It happened because the list was filtered on the delivery
     * destination, which has nothing to do with how someone pays.
     */
    public function test_preview_offers_methods_even_when_shipping_to_another_market(): void
    {
        $this->seedCurrencies();
        Country::query()->firstOrCreate(['code' => 'AE'], ['name' => 'United Arab Emirates', 'phone_code' => '+971', 'currency_code' => 'AED']);
        Country::query()->firstOrCreate(['code' => 'GH'], ['name' => 'Ghana', 'phone_code' => '+233', 'currency_code' => 'GHS']);
        $this->seed(PaymentMethodSeeder::class);
        $this->givenRates();
        $user = $this->customerWithAddressIn('GH');

        $codes = collect($this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/checkout/preview?country=AE')
            ->assertOk()
            ->json('paymentMethods'))->pluck('code')->all();

        // The cart is AED because the shopper's market is the UAE. Their address
        // is in Ghana, which changes the freight and the tax, never the methods.
        $this->assertSame(['aed_cards', 'aed_apple_pay', 'aed_google_pay'], $codes);
    }

    /**
     * A market with no rows of its own still gets a way to pay. The USD rows are
     * the store default's, take any country, and stand in when nothing scoped
     * matches. Without this the shopper is stuck, which is worse than offering a
     * card.
     */
    public function test_unconfigured_market_falls_back_to_the_default_currency_methods(): void
    {
        $this->seedCurrencies();
        $this->givenCountries(['KE', 'NG']);
        $this->seed(PaymentMethodSeeder::class);

        // Nothing is scoped to Kenya, and no seeded row lists KES.
        $codes = collect($this->getJson('/api/v1/payment-methods/checkout?currency=USD&country=KE')
            ->assertOk()
            ->json('paymentMethods'))->pluck('code')->all();

        $this->assertSame(['usd_cards', 'apple_pay', 'google_pay'], $codes);
    }

    /**
     * The fallback must not become an escape hatch for the one thing it exists
     * next to: a currency its gateway cannot carry. A GHS cart in a market with
     * no GHS rows stays empty rather than being offered the USD rows, because
     * charging GHS on Stripe is the "No active channel" failure at checkout.
     */
    public function test_fallback_never_offers_a_gateway_that_cannot_carry_the_currency(): void
    {
        $this->seedCurrencies();
        $this->givenCountries(['KE']);
        $this->seed(PaymentMethodSeeder::class);

        // Ghana's rows are off, so a GHS shopper in Kenya has nothing scoped.
        PaymentMethod::query()->whereIn('code', ['ghs_cards', 'mobile_money'])->update(['is_active' => false]);

        $codes = $this->getJson('/api/v1/payment-methods/checkout?currency=GHS&country=KE')
            ->assertOk()
            ->json('paymentMethods');

        $this->assertSame([], collect($codes)->pluck('code')->all());
    }

    /**
     * A fallback is a last resort, not an extra option. A shopper in a market
     * with its own rows must not also see the default currency's.
     */
    public function test_scoped_methods_win_and_fallbacks_are_not_offered_alongside(): void
    {
        $this->seedCurrencies();
        $this->givenCountries(['GH', 'AE']);
        $this->seed(PaymentMethodSeeder::class);

        $ghs = collect($this->getJson('/api/v1/payment-methods/checkout?currency=GHS&country=GH')
            ->assertOk()
            ->json('paymentMethods'))->pluck('code')->all();
        $this->assertSame(['ghs_cards', 'mobile_money'], $ghs);

        $aed = collect($this->getJson('/api/v1/payment-methods/checkout?currency=AED&country=AE')
            ->assertOk()
            ->json('paymentMethods'))->pluck('code')->all();
        $this->assertSame(['aed_cards', 'aed_apple_pay', 'aed_google_pay'], $aed);

        foreach ([...$ghs, ...$aed] as $code) {
            $this->assertFalse(
                PaymentMethod::query()->where('code', $code)->sole()->is_fallback,
                "{$code} is scoped to its market and must not also stand in as a fallback.",
            );
        }
    }

    /**
     * What the preview offers must be payable. These used to disagree: the list
     * was filtered on currency and destination, while the payment call was not,
     * so a shopper could be shown a method that was then refused at checkout.
     */
    public function test_a_method_the_preview_offers_is_accepted_at_payment_intent(): void
    {
        $this->seedCurrencies();
        $this->givenCountries(['AE']);
        $this->seed(PaymentMethodSeeder::class);

        $offered = $this->getJson('/api/v1/payment-methods/checkout?currency=USD&country=AE')
            ->assertOk()
            ->json('paymentMethods');

        $resolution = app(PaymentMethodResolver::class)->resolve($offered[0]['rid'], 'USD', 'AE');
        $this->assertSame('usd_cards', $resolution['method']?->code);
        $this->assertSame('stripe', $resolution['provider']);
    }

    private function customerWithAddressIn(string $countryCode): User
    {
        $country = Country::query()->where('code', $countryCode)->firstOrFail();
        $user = User::query()->create([
            'name' => 'Kofi',
            'email' => "shopper-{$countryCode}@handco.test",
            'password' => 'password',
            'user_type' => 'customer',
            'email_verified_at' => now(),
        ]);

        Address::query()->create([
            'user_id' => $user->id,
            'first_name' => 'Kofi',
            'last_name' => 'Mensah',
            'phone_country_code' => '+233',
            'phone_number' => '12345678',
            'address_line' => 'fg',
            'city' => 'Accra',
            'region' => 'Eastern',
            'country_id' => $country->id,
            'is_default' => true,
        ]);

        return $user;
    }

    public function test_admin_manages_methods_and_currencies(): void
    {
        config(['admin.mfa_forced' => false, 'inertia.testing.ensure_pages_exist' => false]);
        $this->seedCurrencies();
        Country::query()->firstOrCreate(['code' => 'GH'], ['name' => 'Ghana', 'phone_code' => '+233']);
        $this->seed(AdminPermissionsSeeder::class);
        $staff = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-payments@handco.test',
            'password' => 'password',
            'user_type' => 'staff',
            'email_verified_at' => now(),
            'must_change_password' => false,
            'two_factor_enabled' => false,
        ]);
        $staff->syncPermissions(AdminPermissionsSeeder::PERMISSIONS);
        $prefix = trim((string) config('admin.path_prefix'), '/');

        $asStaff = fn () => $this->actingAs($staff, 'staff');

        $asStaff()->get('/'.$prefix.'/settings/payment-methods')->assertOk();

        $asStaff()->post('/'.$prefix.'/settings/payment-methods', [
            'code' => 'mtn_momo',
            'label' => 'MTN MoMo',
            'provider' => 'fake',
            'currencies' => ['GHS'],
            'countries' => ['GH'],
            'sort_order' => 0,
            'is_active' => true,
            'is_fallback' => false,
        ])->assertSessionHasNoErrors();

        $method = PaymentMethod::query()->where('code', 'mtn_momo')->firstOrFail();
        $this->assertSame(['GHS'], $method->currencyList());

        $asStaff()->put('/'.$prefix.'/settings/payment-methods/'.$method->rid, [
            'code' => 'mtn_momo',
            'label' => 'MTN Mobile Money',
            'provider' => 'fake',
            'currencies' => ['GHS'],
            'sort_order' => 0,
            'is_active' => true,
            'is_fallback' => true,
        ])->assertSessionHasNoErrors();
        $this->assertSame('MTN Mobile Money', $method->refresh()->label);
        $this->assertTrue($method->is_fallback);

        $aed = Currency::query()->where('code', 'AED')->firstOrFail();
        $asStaff()->put('/'.$prefix.'/settings/currencies/'.$aed->rid, [
            'provider' => 'fake',
            'is_default' => true,
        ])->assertSessionHasNoErrors();
        $this->assertTrue($aed->refresh()->is_default);

        $asStaff()->delete('/'.$prefix.'/settings/payment-methods/'.$method->rid)->assertSessionHasNoErrors();
        $this->assertNull(PaymentMethod::query()->where('code', 'mtn_momo')->first());
    }
}
