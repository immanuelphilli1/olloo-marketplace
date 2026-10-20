<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Product;
use App\Models\User;
use Database\Seeders\AdminPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\BuildsCheckout;
use Tests\TestCase;

final class ProductVariantImagesTest extends TestCase
{
    use BuildsCheckout;
    use RefreshDatabase;

    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        config(['admin.mfa_forced' => false, 'inertia.testing.ensure_pages_exist' => false]);
        $this->product = $this->seedCatalog(stock: 5);
        $this->seed(AdminPermissionsSeeder::class);
    }

    public function test_storefront_detail_links_gallery_images_to_variants(): void
    {
        $standard = $this->defaultVariant($this->product);
        $this->save([
            ['rid' => $standard->rid, 'name' => 'Red / S', 'color' => 'Red', 'size' => 'S', 'sku' => $standard->sku, 'is_default' => true],
            ['name' => 'Red / M', 'color' => 'Red', 'size' => 'M', 'sku' => 'tee-red-m'],
            ['name' => 'Blue / S', 'color' => 'Blue', 'size' => 'S', 'sku' => 'TEE-BLUE-S'],
        ], [
            ['path' => '/images/tee.jpg', 'variant_sku' => null],
            ['path' => '/images/tee-blue.jpg', 'variant_sku' => 'TEE-BLUE-S'],
            ['path' => '/images/tee-red.jpg', 'variant_sku' => $standard->sku],
        ])->assertSessionHasNoErrors();

        $blue = $this->product->variants()->where('sku', 'TEE-BLUE-S')->firstOrFail();

        $this->getJson('/api/v1/products/'.$this->product->rid)
            ->assertOk()
            ->assertJsonPath('gallery.0.variantRid', null)
            ->assertJsonPath('gallery.1.variantRid', $blue->rid)
            ->assertJsonPath('gallery.2.variantRid', $standard->rid)
            ->assertJsonPath('gallery.1.imageUrl', url('/images/tee-blue.jpg'))
            ->assertJsonPath('variants.0.imageIndex', 2)
            ->assertJsonPath('variants.1.imageIndex', null)
            ->assertJsonPath('variants.2.imageIndex', 1)
            ->assertJsonPath('optionGroups', [
                ['key' => 'color', 'label' => 'Color', 'values' => ['Red', 'Blue']],
                ['key' => 'size', 'label' => 'Size', 'values' => ['S', 'M']],
            ]);
    }

    public function test_name_only_variants_have_no_option_groups(): void
    {
        $this->getJson('/api/v1/products/'.$this->product->rid)
            ->assertOk()
            ->assertJsonPath('optionGroups', []);
    }

    public function test_sku_renamed_in_the_same_save_still_links_the_image(): void
    {
        $standard = $this->defaultVariant($this->product);

        $this->save(
            [['rid' => $standard->rid, 'name' => 'Standard', 'sku' => 'renamed-sku', 'is_default' => true]],
            [['path' => '/images/p.jpg', 'variant_sku' => 'renamed-sku']],
        )->assertSessionHasNoErrors();

        $this->assertSame('RENAMED-SKU', $standard->refresh()->sku);
        $this->assertSame($standard->id, $this->product->images()->sole()->variant_id);
    }

    public function test_unchanged_resave_keeps_image_links(): void
    {
        $standard = $this->defaultVariant($this->product);
        $variants = [['rid' => $standard->rid, 'name' => 'Standard', 'sku' => $standard->sku, 'is_default' => true]];
        $gallery = [['path' => '/images/p.jpg', 'variant_sku' => $standard->sku]];

        $this->save($variants, $gallery)->assertSessionHasNoErrors();
        $image = $this->product->images()->sole();
        $this->save($variants, $gallery)->assertSessionHasNoErrors();

        $this->assertSame($image->id, $this->product->images()->sole()->id);
        $this->assertSame($standard->id, $this->product->images()->sole()->variant_id);
        $this->assertSame($standard->id, $standard->fresh()?->id);
    }

    public function test_image_cannot_point_at_another_products_variant(): void
    {
        $standard = $this->defaultVariant($this->product);
        $other = $this->product->replicate(['rid'])->fill(['slug' => 'other-product']);
        $other->save();
        $foreign = $other->variants()->create(['name' => 'Other', 'sku' => 'OTHER-1', 'is_default' => true]);

        $this->save(
            [['rid' => $standard->rid, 'name' => 'Standard', 'sku' => $standard->sku, 'is_default' => true]],
            [['path' => '/images/p.jpg', 'variant_sku' => $foreign->sku]],
        )->assertSessionHasErrors('gallery.0.variant_sku');

        $this->assertSame(0, $this->product->images()->count());
    }

    public function test_deleting_a_variant_keeps_its_image_untagged(): void
    {
        $standard = $this->defaultVariant($this->product);
        $this->save([
            ['rid' => $standard->rid, 'name' => 'Standard', 'sku' => $standard->sku, 'is_default' => true],
            ['name' => 'Gold', 'color' => 'Gold', 'sku' => 'GOLD-1'],
        ], [['path' => '/images/gold.jpg', 'variant_sku' => 'GOLD-1']])->assertSessionHasNoErrors();

        // The next save drops the Gold variant but keeps its photo.
        $this->save(
            [['rid' => $standard->rid, 'name' => 'Standard', 'sku' => $standard->sku, 'is_default' => true]],
            [['path' => '/images/gold.jpg', 'variant_sku' => null]],
        )->assertSessionHasNoErrors();
        $this->assertNull($this->product->images()->sole()->variant_id);

        // A variant deleted outside the form leaves the image in the gallery.
        $this->save([
            ['rid' => $standard->rid, 'name' => 'Standard', 'sku' => $standard->sku, 'is_default' => true],
            ['name' => 'Gold', 'color' => 'Gold', 'sku' => 'GOLD-1'],
        ], [['path' => '/images/gold.jpg', 'variant_sku' => 'GOLD-1']])->assertSessionHasNoErrors();
        $this->product->variants()->where('sku', 'GOLD-1')->delete();
        $this->assertNull($this->product->images()->sole()->variant_id);
    }

    /**
     * @param  list<array<string, mixed>>  $variants
     * @param  list<array<string, mixed>>  $gallery
     */
    private function save(array $variants, array $gallery): TestResponse
    {
        $prefix = trim((string) config('admin.path_prefix'), '/');

        return $this->actingAs($this->staff(), 'staff')->put('/'.$prefix.'/products/'.$this->product->rid, [
            'name' => $this->product->name,
            'slug' => $this->product->slug,
            'category_rid' => $this->product->category->rid,
            'price' => '179.00',
            'is_active' => true,
            'is_featured' => false,
            'is_new_arrival' => false,
            'gallery' => $gallery,
            'variants' => array_map(fn (array $variant) => $variant + [
                'price' => null,
                'track_stock' => true,
                'stock_quantity' => 5,
                'is_default' => false,
            ], $variants),
        ]);
    }

    private function staff(): User
    {
        $staff = User::query()->firstOrCreate(['email' => 'admin-variants@handco.test'], [
            'name' => 'Admin',
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
