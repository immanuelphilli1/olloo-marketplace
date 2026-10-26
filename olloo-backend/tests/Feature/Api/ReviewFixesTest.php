<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Enums\OrderPaymentStatus;
use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\User;
use App\Tax\TaxCalculator;
use App\Tax\TaxLine;
use Database\Seeders\AdminPermissionsSeeder;
use Database\Seeders\TaxSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsCheckout;
use Tests\TestCase;

final class ReviewFixesTest extends TestCase
{
    use BuildsCheckout;
    use RefreshDatabase;

    public function test_admin_edits_description_gallery_discount_and_variant_options(): void
    {
        config(['admin.mfa_forced' => false, 'inertia.testing.ensure_pages_exist' => false]);
        $product = $this->seedCatalog(stock: 5);
        $this->seed(AdminPermissionsSeeder::class);
        $staff = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-details@handco.test',
            'password' => 'password',
            'user_type' => 'staff',
            'email_verified_at' => now(),
            'must_change_password' => false,
            'two_factor_enabled' => false,
        ]);
        $staff->syncPermissions(AdminPermissionsSeeder::PERMISSIONS);
        $prefix = trim((string) config('admin.path_prefix'), '/');
        $standard = $this->defaultVariant($product);

        $this->actingAs($staff, 'staff')->put('/'.$prefix.'/products/'.$product->rid, [
            'name' => $product->name,
            'slug' => $product->slug,
            'category_rid' => $product->category->rid,
            'tags' => [],
            'price' => '179.00',
            'original_price' => '219.00',
            'discount_notice' => 'Sale ends Friday',
            'description_lines' => ['First paragraph', 'Second paragraph'],
            'image' => '/images/p.jpg',
            'gallery' => [['path' => '/images/p-2.jpg'], ['path' => '/images/p-3.jpg', 'variant_sku' => null]],
            'is_active' => true,
            'is_featured' => false,
            'is_new_arrival' => false,
            'variants' => [
                ['rid' => $standard->rid, 'name' => 'Standard', 'size' => 'M', 'color' => 'Navy', 'sku' => $standard->sku, 'price' => null, 'track_stock' => true, 'stock_quantity' => 7, 'is_default' => true],
            ],
        ])->assertSessionHasNoErrors();

        $product->refresh();
        $this->assertSame('Sale ends Friday', $product->discount_notice);
        $this->assertSame(['First paragraph', 'Second paragraph'], $product->description_lines);
        $this->assertSame(['/images/p-2.jpg', '/images/p-3.jpg'], $product->images()->orderBy('sort_order')->pluck('path')->all());
        $this->assertSame('M', $standard->refresh()->size);
        $this->assertSame('Navy', $standard->color);

        $this->getJson('/api/v1/products/'.$product->rid)
            ->assertOk()
            ->assertJsonPath('discountNotice', 'Sale ends Friday')
            ->assertJsonPath('descriptionLines', ['First paragraph', 'Second paragraph'])
            ->assertJsonPath('images', ['/images/p-2.jpg', '/images/p-3.jpg'])
            ->assertJsonPath('variants.0.size', 'M')
            ->assertJsonPath('variants.0.color', 'Navy');
    }

    public function test_listing_and_orders_expose_structured_values(): void
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $this->placeOrder($token, $this->createAddress($token))->assertCreated();

        $this->getJson('/api/v1/products')
            ->assertOk()
            ->assertJsonMissingPath('items.0.price')
            ->assertJsonMissingPath('items.0.discount')
            ->assertJsonMissingPath('items.0.delivery')
            ->assertJsonMissingPath('items.0.rating')
            ->assertJsonPath('items.0.priceMoney', ['amount' => 179, 'currency' => 'USD'])
            ->assertJsonPath('items.0.discountPercent', 18)
            // No approved reviews yet, so the product shows the five-star default.
            ->assertJsonPath('items.0.ratingValue', 5)
            ->assertJsonPath('items.0.reviewCount', 0)
            ->assertJsonPath('items.0.soldCount', 0);

        $orders = $this->withToken($token)->getJson('/api/v1/orders')->assertOk();
        $orders->assertJsonPath('orders.0.totalMoney.currency', 'USD');
        $orders->assertJsonMissingPath('orders.0.total');
        $orders->assertJsonMissingPath('orders.0.orderTime');
        $orders->assertJsonMissingPath('orders.0.statusDateLabel');
        $orders->assertJsonMissingPath('orders.0.statusBadgeLabel');
        $this->assertNotEmpty($orders->json('orders.0.statusDate'));
        $this->assertNotEmpty($orders->json('orders.0.placedAt'));

        $this->withToken($token)->getJson('/api/v1/orders/'.$orders->json('orders.0.rid'))
            ->assertOk()
            ->assertJsonPath('returnEligibility.eligible', true);
    }

    public function test_search_alias_is_gone_in_favour_of_q(): void
    {
        $this->seedCatalog();

        // /products/search now falls through to the product detail route and 404s.
        $this->getJson('/api/v1/products/search?q=aero')->assertNotFound();

        $this->getJson('/api/v1/products?q=aero')->assertJsonPath('total', 1);
    }

    public function test_returns_follow_category_eligibility_and_window(): void
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $orderRid = $this->placeOrder($token, $this->createAddress($token))->assertCreated()->json('orderId');

        Order::query()->where('rid', $orderRid)->update([
            'status' => OrderStatus::Delivered->value,
            'payment_status' => OrderPaymentStatus::Paid->value,
            'delivered_at' => now(),
        ]);

        // Non-returnable category blocks the return.
        $product->category->update(['is_returnable' => false]);
        $this->withToken($token)->postJson('/api/v1/orders/'.$orderRid.'/return', [])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'return_not_allowed');

        // An expired window blocks it too.
        $product->category->update(['is_returnable' => true, 'return_window_days' => 30]);
        Order::query()->where('rid', $orderRid)->update(['delivered_at' => now()->subDays(40)]);
        $this->withToken($token)->postJson('/api/v1/orders/'.$orderRid.'/return', [])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'return_not_allowed');

        // Inside the window it succeeds.
        Order::query()->where('rid', $orderRid)->update(['delivered_at' => now()]);
        $this->withToken($token)->postJson('/api/v1/orders/'.$orderRid.'/return', ['reason' => 'Changed my mind'])
            ->assertCreated()
            ->assertJsonPath('success', true);
    }

    public function test_tax_seeder_charges_ae_vat_and_gh_levies_plus_vat(): void
    {
        $this->seed(TaxSeeder::class);
        $taxes = app(TaxCalculator::class);

        $ae = $taxes->calculate('AE', [new TaxLine('line', 10000, null)]);
        $this->assertSame(500, $ae['totalMinor']);

        // Ghana: NHIL 2.5% + GETFund 2.5% on the base, then 15% VAT on the base plus levies.
        $gh = $taxes->calculate('GH', [new TaxLine('line', 10000, null)]);
        $this->assertSame(2075, $gh['totalMinor']);

        $this->assertNull($taxes->calculate(null, [new TaxLine('line', 10000, null)]));
    }
}
