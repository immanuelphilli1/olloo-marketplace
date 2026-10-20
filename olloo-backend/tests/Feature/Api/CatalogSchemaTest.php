<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Enums\OrderPaymentStatus;
use App\Enums\OrderStatus;
use App\Models\Country;
use App\Models\Order;
use App\Models\Product;
use App\Models\Region;
use App\Models\Review;
use App\Models\ShippingRule;
use App\Models\User;
use App\Shipping\ShippingRuleResolver;
use Database\Seeders\AdminPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Schema;
use Tests\Concerns\BuildsCheckout;
use Tests\TestCase;

final class CatalogSchemaTest extends TestCase
{
    use BuildsCheckout;
    use RefreshDatabase;

    public function test_listing_filters_and_facets_come_from_attributes(): void
    {
        $sony = $this->seedCatalog();
        $other = $this->seedCatalog();
        $this->defineAttribute($other->category, 'material', 'Material');
        $other->syncAttributes(['brand' => 'Bose', 'color' => 'White', 'material' => 'Plastic']);

        $this->getJson('/api/v1/products')
            ->assertOk()
            ->assertJsonPath('facets.brands', ['Bose', 'Sony'])
            ->assertJsonPath('facets.attributes.material', ['Plastic'])
            ->assertJsonPath('facets.attributeLabels.material', 'Material');

        $this->getJson('/api/v1/products?brand=Sony')
            ->assertJsonPath('total', 1)
            ->assertJsonPath('items.0.rid', $sony->rid)
            ->assertJsonPath('items.0.brand', 'Sony')
            ->assertJsonPath('items.0.attributes', [
                ['key' => 'brand', 'label' => 'Brand', 'value' => 'Sony'],
                ['key' => 'color', 'label' => 'Color', 'value' => 'Black'],
            ]);

        $this->getJson('/api/v1/products?attributes[material]=Plastic')
            ->assertJsonPath('total', 1)
            ->assertJsonPath('items.0.rid', $other->rid);

        $this->getJson('/api/v1/products?q=bose')->assertJsonPath('total', 1);
    }

    public function test_display_column_styling_hints_are_not_exposed(): void
    {
        $product = $this->seedCatalog();
        $product->update(['display' => ['priceOrange' => true, 'showAddButton' => false]]);

        // Presentation hints live in products.display for the admin only; the
        // API exposes capability (inStock) and lets the client style it.
        $this->getJson('/api/v1/products')
            ->assertOk()
            ->assertJsonMissingPath('items.0.priceOrange')
            ->assertJsonMissingPath('items.0.showAddButton')
            ->assertJsonMissingPath('items.0.imageObjectPosition')
            ->assertJsonPath('items.0.inStock', true);
    }

    public function test_product_detail_has_no_shipping_claims_without_a_destination(): void
    {
        $product = $this->seedCatalog();

        $this->getJson('/api/v1/products/'.$product->rid)
            ->assertOk()
            ->assertJsonPath('product.attributes.0', ['key' => 'brand', 'label' => 'Brand', 'value' => 'Sony'])
            ->assertJsonPath('shippingFeeMoney', null)
            ->assertJsonPath('variants.0.sku', $this->defaultVariant($product)->sku)
            ->assertJsonPath('variants.0.inStock', true);
    }

    public function test_address_country_is_resolved_and_linked_to_geo(): void
    {
        $this->seedCatalog();
        $country = Country::query()->where('code', 'AE')->firstOrFail();
        $dubai = Region::query()->create(['country_id' => $country->id, 'name' => 'Dubai']);
        [, $token] = $this->customer();

        $this->withToken($token)->postJson('/api/v1/addresses', [
            'country' => 'United Arab Emirates',
            'firstName' => 'A',
            'lastName' => 'B',
            'phoneCountryCode' => '+971',
            'phoneNumber' => '1',
            'addressLine' => 'Street',
            'region' => 'dubai',
            'city' => 'Jumeirah',
        ])
            ->assertCreated()
            ->assertJsonPath('countryCode', 'AE')
            ->assertJsonPath('region', 'Dubai')
            ->assertJsonPath('regionRid', $dubai->rid)
            ->assertJsonPath('city', 'Jumeirah')
            ->assertJsonPath('cityRid', null);

        $this->withToken($token)->postJson('/api/v1/addresses', [
            'country' => 'Atlantis',
            'firstName' => 'A',
            'lastName' => 'B',
            'phoneCountryCode' => '+1',
            'phoneNumber' => '1',
            'addressLine' => 'Street',
            'region' => 'X',
            'city' => 'Y',
        ])->assertUnprocessable();
    }

    public function test_shipping_quote_matches_country_rules_by_iso_code(): void
    {
        $product = $this->seedCatalog();
        ShippingRule::query()->create([
            'name' => 'UAE',
            'strategy' => ShippingRule::STRATEGY_FLAT,
            'fee_minor' => 500,
            'currency_code' => 'USD',
            'country' => 'AE',
            'priority' => 1,
            'is_active' => true,
            'transit_days_min' => 2,
            'transit_days_max' => 4,
        ]);
        app(ShippingRuleResolver::class)->clearCache();
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();

        // Typed as a country name, still matches the AE rule.
        $this->withToken($token)->postJson('/api/v1/checkout/shipping-quote', [
            'country' => 'united arab emirates',
            'firstName' => 'A',
            'lastName' => 'B',
            'phoneCountryCode' => '+971',
            'phoneNumber' => '1',
            'addressLine' => 'Street',
            'region' => 'Dubai',
            'city' => 'Dubai',
        ])->assertOk()->assertJsonPath('feeMoney', ['amount' => 5, 'currency' => 'USD']);
    }

    public function test_reviews_wait_for_moderation_and_only_one_per_order_line(): void
    {
        Queue::fake();
        $product = $this->seedCatalog();
        [$user, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $orderRid = $this->placeOrder($token, $this->createAddress($token))->json('orderId');
        Order::query()->where('rid', $orderRid)->update([
            'status' => OrderStatus::Delivered->value,
            'payment_status' => OrderPaymentStatus::Paid->value,
        ]);

        $lineRid = $this->withToken($token)->getJson('/api/v1/reviews/waiting')->assertOk()->json('items.0.rid');

        $this->withToken($token)->postJson('/api/v1/reviews', ['reviewId' => $lineRid, 'rating' => 5])
            ->assertCreated()
            ->assertJsonPath('status', 'pending');

        $this->assertFalse(Review::query()->firstOrFail()->is_approved);
        $this->withToken($token)->getJson('/api/v1/reviews/waiting')->assertJsonCount(0, 'items');
        $this->withToken($token)->postJson('/api/v1/reviews', ['reviewId' => $lineRid, 'rating' => 4])->assertNotFound();
        $this->getJson('/api/v1/products/'.$product->rid.'/reviews')->assertJsonCount(0, 'reviews');
    }

    public function test_admin_saves_variants_with_stock_and_attributes(): void
    {
        config(['admin.mfa_forced' => false, 'inertia.testing.ensure_pages_exist' => false]);
        $product = $this->seedCatalog(stock: 5);
        $this->seed(AdminPermissionsSeeder::class);
        $staff = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-variants@handco.test',
            'password' => 'password',
            'user_type' => 'staff',
            'email_verified_at' => now(),
            'must_change_password' => false,
            'two_factor_enabled' => false,
        ]);
        $staff->syncPermissions(AdminPermissionsSeeder::PERMISSIONS);
        $prefix = trim((string) config('admin.path_prefix'), '/');
        $standard = $this->defaultVariant($product);
        $material = $this->defineAttribute($product->category, 'material', 'Material');

        $this->actingAs($staff, 'staff')->put('/'.$prefix.'/products/'.$product->rid, [
            'name' => $product->name,
            'slug' => $product->slug,
            'category_rid' => $product->category->rid,
            'tags' => [],
            'price' => '179.00',
            'is_active' => true,
            'is_featured' => false,
            'is_new_arrival' => false,
            'attributes' => [['attribute_rid' => $material->rid, 'value' => 'Aluminium']],
            'variants' => [
                ['rid' => $standard->rid, 'name' => 'Standard', 'sku' => $standard->sku, 'price' => null, 'track_stock' => true, 'stock_quantity' => 7, 'is_default' => false],
                ['rid' => null, 'name' => 'Pro', 'sku' => 'pro-1', 'price' => '199.00', 'track_stock' => false, 'stock_quantity' => null, 'is_default' => true],
            ],
        ])->assertSessionHasNoErrors();

        $product->refresh();
        $this->assertSame(['material' => 'Aluminium'], $product->attributeMap());
        $this->assertSame(7, $standard->refresh()->stock_quantity);
        $pro = $product->variants()->where('sku', 'PRO-1')->firstOrFail();
        $this->assertTrue($pro->is_default);
        $this->assertNull($pro->stock_quantity);
        $this->assertSame(19900, $pro->price_minor);
        $this->assertFalse($standard->is_default);
    }

    public function test_admin_rejects_a_sku_used_by_another_product(): void
    {
        config(['admin.mfa_forced' => false]);
        $first = $this->seedCatalog();
        $second = $this->seedCatalog();
        $this->seed(AdminPermissionsSeeder::class);
        $staff = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-sku@handco.test',
            'password' => 'password',
            'user_type' => 'staff',
            'email_verified_at' => now(),
            'must_change_password' => false,
            'two_factor_enabled' => false,
        ]);
        $staff->syncPermissions(AdminPermissionsSeeder::PERMISSIONS);
        $prefix = trim((string) config('admin.path_prefix'), '/');

        $this->actingAs($staff, 'staff')->put('/'.$prefix.'/products/'.$second->rid, [
            'name' => $second->name,
            'slug' => $second->slug,
            'category_rid' => $second->category->rid,
            'price' => '179.00',
            'is_active' => true,
            'is_featured' => false,
            'is_new_arrival' => false,
            'variants' => [
                ['rid' => null, 'name' => 'Standard', 'sku' => $this->defaultVariant($first)->sku, 'price' => null, 'track_stock' => false, 'stock_quantity' => null, 'is_default' => true],
            ],
        ])->assertSessionHasErrors('variants.0.sku');
    }

    public function test_product_detail_has_no_per_product_shipping_column(): void
    {
        $this->assertFalse(Schema::hasColumn('products', 'shipping_fee_minor'));
        $this->assertFalse(Product::query()->getModel()->isFillable('brand'));
    }
}
