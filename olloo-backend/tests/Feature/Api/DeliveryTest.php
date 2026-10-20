<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Country;
use App\Models\Order;
use App\Models\ShippingClass;
use App\Models\ShippingRule;
use App\Services\DeliveryQuoteCache;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\Concerns\BuildsCheckout;
use Tests\TestCase;

/**
 * Delivery is worked out from shipping rules (fee, transit days) plus each
 * variant's handling time, and is only shown when the destination is known.
 * The fixture's default rule: USD 20 flat, 2-4 transit days; default
 * handling is 1 day, so standard delivery is 3-5 business days.
 */
final class DeliveryTest extends TestCase
{
    use BuildsCheckout;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['shipping.default_handling_days' => 1]);
    }

    public function test_no_destination_means_no_delivery_claims(): void
    {
        $this->seedCatalog();

        $this->getJson('/api/v1/products')
            ->assertOk()
            ->assertJsonMissingPath('items.0.delivery')
            ->assertJsonPath('items.0.deliveryQuote', null)
            ->assertJsonPath('facets.delivery', null);
    }

    public function test_destination_shows_fee_and_window_from_rules_and_handling(): void
    {
        $product = $this->seedCatalog();

        $this->getJson('/api/v1/products?country=AE')
            ->assertJsonPath('items.0.deliveryQuote', [
                'free' => false,
                'fee' => ['amount' => 20, 'currency' => 'USD'],
                'minDays' => 3,
                'maxDays' => 5,
            ])
            ->assertJsonPath('facets.delivery', ['freeCount' => 0, 'deliveryDays' => [5]]);

        $this->getJson('/api/v1/products/'.$product->rid.'?country=AE')
            ->assertJsonPath('shippingFeeMoney.amount', 20)
            ->assertJsonPath('deliveryDays', ['min' => 3, 'max' => 5])
            ->assertJsonPath('variants.0.deliveryQuote.minDays', 3)
            ->assertJsonPath('variants.0.deliveryQuote.maxDays', 5);
    }

    public function test_free_badge_only_when_the_rules_charge_nothing(): void
    {
        $this->seedCatalog();
        $this->freeOver(10000);

        $this->getJson('/api/v1/products?country=AE')
            ->assertJsonPath('items.0.deliveryQuote.free', true)
            ->assertJsonPath('items.0.deliveryQuote.minDays', 3);
    }

    public function test_signed_in_default_address_is_the_destination(): void
    {
        $this->seedCatalog();
        [, $token] = $this->customer();
        $this->createAddress($token);

        $this->withToken($token)->getJson('/api/v1/products')
            ->assertJsonPath('items.0.deliveryQuote.minDays', 3)
            ->assertJsonPath('items.0.deliveryQuote.maxDays', 5);
    }

    public function test_variant_handling_time_changes_delivery_and_refreshes_listings(): void
    {
        $product = $this->seedCatalog();
        $variant = $this->defaultVariant($product);
        $variant->update(['handling_days' => 4]);

        $this->getJson('/api/v1/products?country=AE')
            ->assertJsonPath('items.0.deliveryQuote.minDays', 6)
            ->assertJsonPath('items.0.deliveryQuote.maxDays', 8);

        $this->getJson('/api/v1/products/'.$product->rid.'?country=AE')
            ->assertJsonPath('variants.0.handlingDays', 4)
            ->assertJsonPath('variants.0.deliveryQuote.minDays', 6);
    }

    public function test_delivery_filters_need_a_destination(): void
    {
        $this->seedCatalog();

        $this->getJson('/api/v1/products?freeDelivery=1')
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'destination_required');
    }

    public function test_free_and_max_days_filters(): void
    {
        $cheap = $this->seedCatalog(priceMinor: 5000);
        $pricey = $this->seedCatalog(priceMinor: 50000);
        $this->freeOver(40000);
        $this->defaultVariant($cheap)->update(['handling_days' => 0]);

        $this->getJson('/api/v1/products?country=AE&freeDelivery=1')
            ->assertJsonPath('total', 1)
            ->assertJsonPath('items.0.rid', $pricey->rid);

        $this->getJson('/api/v1/products?country=AE&maxDeliveryDays=4')
            ->assertJsonPath('total', 1)
            ->assertJsonPath('items.0.rid', $cheap->rid);
    }

    public function test_country_rules_apply_to_their_country_only(): void
    {
        $this->seedCatalog();
        Country::query()->firstOrCreate(['code' => 'GH'], ['name' => 'Ghana']);
        ShippingRule::query()->create([
            'name' => 'UAE express',
            'strategy' => ShippingRule::STRATEGY_FLAT,
            'fee_minor' => 1000,
            'currency_code' => 'USD',
            'country' => 'AE',
            'priority' => 1,
            'is_active' => true,
            'transit_days_min' => 1,
            'transit_days_max' => 1,
        ]);

        $this->getJson('/api/v1/products?country=AE')->assertJsonPath('items.0.deliveryQuote', [
            'free' => false,
            'fee' => ['amount' => 10, 'currency' => 'USD'],
            'minDays' => 2,
            'maxDays' => 2,
        ]);
        $this->getJson('/api/v1/products?country=GH')->assertJsonPath('items.0.deliveryQuote.minDays', 3);
    }

    public function test_shipping_classes_price_separately_and_take_the_slowest_window(): void
    {
        Queue::fake();
        $small = $this->seedCatalog();
        $sofa = $this->seedCatalog(priceMinor: 90000);
        $bulky = ShippingClass::query()->create(['name' => 'Bulky']);
        ShippingRule::query()->create([
            'name' => 'Bulky items',
            'strategy' => ShippingRule::STRATEGY_FLAT,
            'fee_minor' => 15000,
            'currency_code' => 'USD',
            'shipping_class_id' => $bulky->id,
            'priority' => 100,
            'is_active' => true,
            'transit_days_min' => 5,
            'transit_days_max' => 10,
        ]);
        $sofa->update(['shipping_class_id' => $bulky->id]);
        app(DeliveryQuoteCache::class)->refreshAll();

        $this->getJson('/api/v1/products/'.$sofa->rid.'?country=AE')
            ->assertJsonPath('product.deliveryQuote.minDays', 6)
            ->assertJsonPath('product.deliveryQuote.maxDays', 11)
            ->assertJsonPath('shippingFeeMoney.amount', 150);

        [, $token] = $this->customer();
        $this->addToCart($token, $small)->assertOk();
        $this->addToCart($token, $sofa)->assertOk();
        $addressRid = $this->createAddress($token);

        // Standard group USD 20 + bulky group USD 150; slowest group sets the window.
        $orderRid = $this->placeOrder($token, $addressRid)->assertCreated()->json('orderId');
        $order = Order::query()->where('rid', $orderRid)->firstOrFail();
        $this->assertSame(17000, $order->shipping_minor);
        $this->assertSame(['min' => 6, 'max' => 11], $order->shipping_snapshot['deliveryDays']);
        $this->assertSame('Estimated delivery: 6-11 business days', $order->estimated_delivery);
    }

    public function test_rule_changes_refresh_listing_quotes(): void
    {
        $this->seedCatalog();
        $rule = ShippingRule::query()->firstOrFail();

        $rule->update(['fee_minor' => 0, 'transit_days_min' => 1, 'transit_days_max' => 2]);

        $this->getJson('/api/v1/products?country=AE')
            ->assertJsonPath('items.0.deliveryQuote.free', true)
            ->assertJsonPath('items.0.deliveryQuote.minDays', 2);
    }

    public function test_checkout_quote_returns_delivery_days(): void
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $this->createAddress($token);

        $this->withToken($token)->getJson('/api/v1/checkout/preview')
            ->assertJsonPath('shipping.deliveryDays', ['min' => 3, 'max' => 5])
            ->assertJsonPath('shipping.feeMoney.amount', 20);
    }

    private function freeOver(int $thresholdMinor): void
    {
        ShippingRule::query()->create([
            'name' => 'Free over threshold',
            'strategy' => ShippingRule::STRATEGY_FREE_OVER_THRESHOLD,
            'fee_minor' => 0,
            'currency_code' => 'USD',
            'min_subtotal_minor' => $thresholdMinor,
            'priority' => 1,
            'is_active' => true,
            'transit_days_min' => 2,
            'transit_days_max' => 4,
        ]);
    }
}
