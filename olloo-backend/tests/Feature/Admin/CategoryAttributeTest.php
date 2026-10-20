<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Database\Seeders\AdminPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use InvalidArgumentException;
use Tests\Concerns\BuildsCheckout;
use Tests\TestCase;

final class CategoryAttributeTest extends TestCase
{
    use BuildsCheckout;
    use RefreshDatabase;

    private string $prefix;

    protected function setUp(): void
    {
        parent::setUp();
        config(['admin.mfa_forced' => false, 'inertia.testing.ensure_pages_exist' => false]);
        $this->prefix = '/'.trim((string) config('admin.path_prefix'), '/');
    }

    public function test_category_defines_attributes_with_stable_keys(): void
    {
        $this->actingAs($this->staff(), 'staff')
            ->post($this->prefix.'/categories', $this->categoryPayload('TVs', 'tvs', [
                ['rid' => null, 'label' => 'Screen size', 'options' => ['55"', '65"']],
                ['rid' => null, 'label' => 'Brand', 'options' => []],
            ]))
            ->assertSessionHasNoErrors();

        $tvs = Category::query()->where('slug', 'tvs')->firstOrFail();
        $this->assertSame(['screenSize', 'brand'], $tvs->attributeDefinitions()->pluck('key')->all());
        $screen = $tvs->attributeDefinitions()->where('key', 'screenSize')->firstOrFail();
        $this->assertSame(['55"', '65"'], $screen->options);
        $this->assertNull($tvs->attributeDefinitions()->where('key', 'brand')->value('options'));

        // Renaming keeps the key that storefront filters use.
        $this->actingAs($this->staff(), 'staff')
            ->put($this->prefix.'/categories/'.$tvs->rid, $this->categoryPayload('TVs', 'tvs', [
                ['rid' => $screen->rid, 'label' => 'Display size', 'options' => ['55"', '65"']],
            ]))
            ->assertSessionHasNoErrors();

        $screen->refresh();
        $this->assertSame('Display size', $screen->label);
        $this->assertSame('screenSize', $screen->key);
        $this->assertSame(1, $tvs->attributeDefinitions()->count());
    }

    public function test_keys_must_be_unique_across_the_category_lineage(): void
    {
        $staff = $this->staff();
        $parent = Category::query()->create(['slug' => 'electronics', 'label' => 'Electronics']);
        $this->defineAttribute($parent, 'brand', 'Brand');
        $child = Category::query()->create(['slug' => 'phones', 'label' => 'Phones', 'parent_id' => $parent->id]);
        $this->defineAttribute($child, 'storage', 'Storage');

        $this->actingAs($staff, 'staff')
            ->put($this->prefix.'/categories/'.$child->rid, $this->categoryPayload('Phones', 'phones', [
                ['rid' => null, 'label' => 'Brand', 'options' => []],
            ], $parent->rid))
            ->assertSessionHasErrors(['attributes.0.label' => 'Already inherited from "Electronics". Products here can use it as is.']);

        $this->actingAs($staff, 'staff')
            ->put($this->prefix.'/categories/'.$parent->rid, $this->categoryPayload('Electronics', 'electronics', [
                ['rid' => $parent->attributeDefinitions()->value('rid'), 'label' => 'Brand', 'options' => []],
                ['rid' => null, 'label' => 'Storage', 'options' => []],
            ]))
            ->assertSessionHasErrors('attributes.1.label');

        $this->actingAs($staff, 'staff')
            ->post($this->prefix.'/categories', $this->categoryPayload('Misc', 'misc', [
                ['rid' => null, 'label' => 'Delivery', 'options' => []],
            ]))
            ->assertSessionHasErrors('attributes.0.label');
    }

    public function test_allowed_values_must_cover_values_products_already_use(): void
    {
        $product = $this->seedCatalog();
        $color = $product->category->attributeDefinitions()->where('key', 'color')->firstOrFail();

        $this->actingAs($this->staff(), 'staff')
            ->put($this->prefix.'/categories/'.$product->category->rid, $this->categoryPayload('Electronics', 'electronics', [
                ['rid' => $product->category->attributeDefinitions()->where('key', 'brand')->value('rid'), 'label' => 'Brand', 'options' => []],
                ['rid' => $color->rid, 'label' => 'Color', 'options' => ['White']],
            ]))
            ->assertSessionHasErrors('attributes.1.options');

        $this->assertNull($color->refresh()->options);
    }

    public function test_removing_an_attribute_removes_its_product_values(): void
    {
        $product = $this->seedCatalog();
        $brand = $product->category->attributeDefinitions()->where('key', 'brand')->firstOrFail();

        $this->actingAs($this->staff(), 'staff')
            ->put($this->prefix.'/categories/'.$product->category->rid, $this->categoryPayload('Electronics', 'electronics', [
                ['rid' => $brand->rid, 'label' => 'Brand', 'options' => []],
            ]))
            ->assertSessionHasNoErrors();

        $this->assertSame(['brand' => 'Sony'], $product->refresh()->attributeMap());
    }

    public function test_products_only_take_attributes_their_category_offers(): void
    {
        $product = $this->seedCatalog();
        $subcategory = Category::query()->create(['slug' => 'headphones', 'label' => 'Headphones', 'parent_id' => $product->category_id]);
        $fit = $this->defineAttribute($subcategory, 'fit', 'Fit', ['In-ear', 'Over-ear']);
        $elsewhere = $this->defineAttribute(Category::query()->create(['slug' => 'garden', 'label' => 'Garden']), 'material', 'Material');
        $brand = $product->category->attributeDefinitions()->where('key', 'brand')->firstOrFail();
        $staff = $this->staff();

        $payload = fn (array $attributes) => $this->productPayload($product, $subcategory, $attributes);

        // Inherited (brand) and own (fit) attributes are accepted.
        $this->actingAs($staff, 'staff')
            ->put($this->prefix.'/products/'.$product->rid, $payload([
                ['attribute_rid' => $brand->rid, 'value' => 'Sony'],
                ['attribute_rid' => $fit->rid, 'value' => 'Over-ear'],
            ]))
            ->assertSessionHasNoErrors();
        $this->assertSame(['brand' => 'Sony', 'fit' => 'Over-ear'], $product->refresh()->attributeMap());

        $this->actingAs($staff, 'staff')
            ->put($this->prefix.'/products/'.$product->rid, $payload([['attribute_rid' => $elsewhere->rid, 'value' => 'Wood']]))
            ->assertSessionHasErrors('attributes.0.attribute_rid');

        $this->actingAs($staff, 'staff')
            ->put($this->prefix.'/products/'.$product->rid, $payload([['attribute_rid' => $fit->rid, 'value' => 'On-ear']]))
            ->assertSessionHasErrors(['attributes.0.value' => 'Pick one of: In-ear, Over-ear.']);
    }

    public function test_model_refuses_values_for_undefined_attributes(): void
    {
        $product = $this->seedCatalog();

        $this->expectException(InvalidArgumentException::class);
        $product->syncAttributes(['material' => 'Steel']);
    }

    public function test_forms_receive_definitions_and_show_page_marks_inherited(): void
    {
        $product = $this->seedCatalog();
        $child = Category::query()->create(['slug' => 'earbuds', 'label' => 'Earbuds', 'parent_id' => $product->category_id]);
        $staff = $this->staff();

        $this->actingAs($staff, 'staff')
            ->get($this->prefix.'/products/create')
            ->assertInertia(fn (Assert $page) => $page
                ->where('attributeDefinitions.0.categoryRid', $product->category->rid)
                ->where('attributeDefinitions.0.usedValues', ['Sony'])
            );

        $this->actingAs($staff, 'staff')
            ->get($this->prefix.'/categories/'.$child->rid)
            ->assertInertia(fn (Assert $page) => $page
                ->has('category.attributes', 2)
                ->where('category.attributes.0.inheritedFrom.rid', $product->category->rid)
            );
    }

    /**
     * @param  list<array<string, mixed>>  $attributes
     * @return array<string, mixed>
     */
    private function categoryPayload(string $label, string $slug, array $attributes, ?string $parentRid = null): array
    {
        return [
            'label' => $label,
            'slug' => $slug,
            'parent_rid' => $parentRid,
            'sort_order' => 0,
            'is_active' => true,
            'attributes' => $attributes,
        ];
    }

    /**
     * @param  list<array<string, string>>  $attributes
     * @return array<string, mixed>
     */
    private function productPayload(Product $product, Category $category, array $attributes): array
    {
        $variant = $this->defaultVariant($product);

        return [
            'name' => $product->name,
            'slug' => $product->slug,
            'category_rid' => $category->rid,
            'price' => '179.00',
            'is_active' => true,
            'is_featured' => false,
            'is_new_arrival' => false,
            'attributes' => $attributes,
            'variants' => [[
                'rid' => $variant->rid, 'name' => $variant->name, 'sku' => $variant->sku, 'price' => null,
                'track_stock' => false, 'stock_quantity' => null, 'is_default' => true,
            ]],
        ];
    }

    private function staff(): User
    {
        $this->seed(AdminPermissionsSeeder::class);

        return User::query()->firstOrCreate(['email' => 'admin-attributes@handco.test'], [
            'name' => 'Admin',
            'password' => 'password',
            'user_type' => 'staff',
            'email_verified_at' => now(),
            'must_change_password' => false,
            'two_factor_enabled' => false,
        ])->syncPermissions(AdminPermissionsSeeder::PERMISSIONS);
    }
}
