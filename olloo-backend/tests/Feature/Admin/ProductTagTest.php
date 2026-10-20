<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Category;
use App\Models\Product;
use App\Models\ShippingClass;
use App\Models\Tag;
use App\Models\User;
use Database\Seeders\AdminPermissionsSeeder;
use Database\Seeders\CurrencySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class ProductTagTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['admin.mfa_forced' => false]);
    }

    private function prefix(): string
    {
        return trim((string) config('admin.path_prefix'), '/');
    }

    private function makeStaff(): User
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);

        $staff = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-tags@handco.test',
            'password' => 'password',
            'user_type' => 'staff',
            'email_verified_at' => now(),
            'must_change_password' => false,
            'two_factor_enabled' => false,
        ]);

        $staff->syncPermissions(AdminPermissionsSeeder::PERMISSIONS);

        return $staff;
    }

    private function makeCategory(): Category
    {
        return Category::query()->create([
            'slug' => 'test-cat',
            'label' => 'Test Cat',
        ]);
    }

    private function productPayload(Category $category, array $overrides = []): array
    {
        return array_merge([
            'name' => 'Tagged Product',
            'slug' => 'tagged-product',
            'category_rid' => $category->rid,
            'tags' => ['New', 'Best seller'],
            'price' => '99.99',
            'is_active' => true,
            'is_featured' => false,
            'is_new_arrival' => true,
            'variants' => [[
                'rid' => null,
                'name' => 'Standard',
                'sku' => 'SKU-'.($overrides['slug'] ?? 'tagged-product'),
                'price' => null,
                'track_stock' => true,
                'stock_quantity' => 5,
                'is_default' => true,
            ]],
        ], $overrides);
    }

    public function test_store_creates_tags_and_syncs_pivot(): void
    {
        $staff = $this->makeStaff();
        $category = $this->makeCategory();

        $this->actingAs($staff, 'staff')
            ->post('/'.$this->prefix().'/products', $this->productPayload($category))
            ->assertRedirect();

        $product = Product::query()->where('slug', 'tagged-product')->firstOrFail();

        // Tags keep the order staff entered them in; the first is the badge.
        $this->assertSame(['New', 'Best seller'], $product->tags()->pluck('name')->all());
        $this->assertSame(2, Tag::query()->count());
    }

    public function test_store_reuses_existing_tag(): void
    {
        $staff = $this->makeStaff();
        $category = $this->makeCategory();

        $this->actingAs($staff, 'staff')
            ->post('/'.$this->prefix().'/products', $this->productPayload($category))
            ->assertRedirect();

        $this->actingAs($staff, 'staff')
            ->post('/'.$this->prefix().'/products', $this->productPayload($category, [
                'slug' => 'tagged-product-2',
                'name' => 'Tagged Product 2',
                'tags' => ['New', 'Limited'],
            ]))
            ->assertRedirect();

        $this->assertSame(3, Tag::query()->count());
        $this->assertSame(1, Tag::query()->where('name', 'New')->count());
    }

    public function test_update_replaces_tags(): void
    {
        $staff = $this->makeStaff();
        $category = $this->makeCategory();

        $this->actingAs($staff, 'staff')
            ->post('/'.$this->prefix().'/products', $this->productPayload($category))
            ->assertRedirect();

        $product = Product::query()->where('slug', 'tagged-product')->firstOrFail();

        $this->actingAs($staff, 'staff')
            ->put('/'.$this->prefix().'/products/'.$product->rid, $this->productPayload($category, [
                'tags' => ['Clearance'],
            ]))
            ->assertRedirect();

        $product->refresh();

        $this->assertSame(['Clearance'], $product->tags()->pluck('name')->all());

        $this->actingAs($staff, 'staff')
            ->put('/'.$this->prefix().'/products/'.$product->rid, $this->productPayload($category, [
                'tags' => [],
            ]))
            ->assertRedirect();

        $product->refresh();

        $this->assertSame([], $product->tags()->pluck('name')->all());
    }

    public function test_store_and_update_shipping_class_and_handling_days(): void
    {
        $staff = $this->makeStaff();
        $category = $this->makeCategory();
        $bulky = ShippingClass::query()->create(['name' => 'Bulky']);
        $variant = fn (mixed $handling) => [[
            'rid' => null,
            'name' => 'Standard',
            'sku' => 'SKU-tagged-product',
            'price' => null,
            'track_stock' => false,
            'stock_quantity' => null,
            'handling_days' => $handling,
            'is_default' => true,
        ]];

        $this->actingAs($staff, 'staff')
            ->post('/'.$this->prefix().'/products', $this->productPayload($category, [
                'shipping_class_rid' => $bulky->rid,
                'variants' => $variant(3),
            ]))
            ->assertSessionHasNoErrors();

        $product = Product::query()->where('slug', 'tagged-product')->firstOrFail();
        $this->assertSame($bulky->id, $product->shipping_class_id);
        $this->assertSame(3, $product->defaultVariant->handling_days);

        $this->actingAs($staff, 'staff')
            ->put('/'.$this->prefix().'/products/'.$product->rid, $this->productPayload($category, [
                'shipping_class_rid' => '',
                'variants' => $variant(''),
            ]))
            ->assertSessionHasNoErrors();

        $product->refresh();
        $this->assertNull($product->shipping_class_id);
        $this->assertNull($product->defaultVariant()->first()->handling_days);
        $this->assertSame((int) config('shipping.default_handling_days'), $product->defaultVariant()->first()->effectiveHandlingDays());
    }
}
