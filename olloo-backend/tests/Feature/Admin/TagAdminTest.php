<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Category;
use App\Models\Product;
use App\Models\Tag;
use App\Models\User;
use Database\Seeders\AdminPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\SeedsCurrencies;
use Tests\TestCase;

final class TagAdminTest extends TestCase
{
    use RefreshDatabase;
    use SeedsCurrencies;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedCurrencies();
        config(['admin.mfa_forced' => false]);
        config(['inertia.testing.ensure_pages_exist' => false]);
    }

    public function test_index_lists_tags_with_product_counts(): void
    {
        $staff = $this->makeStaff();
        $this->makeProduct('one', ['Sale', 'New']);
        $this->makeProduct('two', ['Sale']);

        $this->actingAs($staff, 'staff')
            ->get($this->url('tags'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Tags/Index')
                ->where('tags.data.0.name', 'New')
                ->where('tags.data.0.productsCount', 1)
                ->where('tags.data.1.name', 'Sale')
                ->where('tags.data.1.productsCount', 2)
                ->where('total', 2)
            );
    }

    /**
     * Tags are the one list here that grows with the catalog, so it is paged
     * and searched on the server rather than filtered in the browser.
     */
    public function test_the_index_pages_and_searches_tags(): void
    {
        $staff = $this->makeStaff();
        $this->makeProduct('one', ['Sale']);

        foreach (range(1, 60) as $index) {
            Tag::query()->create(['name' => sprintf('Bulk %02d', $index), 'slug' => 'bulk-'.$index]);
        }

        $this->actingAs($staff, 'staff')
            ->get($this->url('tags'))
            ->assertInertia(fn (Assert $page) => $page
                ->has('tags.data', config('admin.per_page'))
                ->where('total', 61)
            );

        $this->actingAs($staff, 'staff')
            ->get($this->url('tags?q=Bulk 07'))
            ->assertInertia(fn (Assert $page) => $page
                ->has('tags.data', 1)
                ->where('tags.data.0.name', 'Bulk 07')
                ->where('filters.q', 'Bulk 07')
            );

        // The merge picker must be able to name a tag on another page.
        $this->actingAs($staff, 'staff')
            ->get($this->url('tags'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('mergeTargets', fn ($targets): bool => $targets->count() === 61)
            );
    }

    /**
     * The unused count describes the whole catalog, not the page on screen,
     * otherwise it silently becomes wrong the moment there is a second page.
     */
    public function test_the_unused_count_covers_every_page(): void
    {
        $staff = $this->makeStaff();
        $this->makeProduct('one', ['Used']);

        foreach (range(1, 60) as $index) {
            Tag::query()->create(['name' => sprintf('Unused %02d', $index), 'slug' => 'unused-'.$index]);
        }

        $this->actingAs($staff, 'staff')
            ->get($this->url('tags?page=2'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('unused', 60)
            );
    }

    public function test_rename_updates_legacy_badge(): void
    {
        $staff = $this->makeStaff();
        $product = $this->makeProduct('one', ['Sale']);
        $tag = Tag::query()->where('name', 'Sale')->firstOrFail();

        $this->actingAs($staff, 'staff')
            ->put($this->url('tags/'.$tag->rid), ['name' => 'On sale'])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertSame('On sale', $tag->refresh()->name);
        $this->assertSame(['On sale'], $product->refresh()->tags()->orderByPivot('position')->pluck('name')->all());
    }

    public function test_rename_to_existing_name_is_rejected(): void
    {
        $staff = $this->makeStaff();
        $this->makeProduct('one', ['Sale', 'New']);
        $tag = Tag::query()->where('name', 'Sale')->firstOrFail();

        $this->actingAs($staff, 'staff')
            ->put($this->url('tags/'.$tag->rid), ['name' => 'New'])
            ->assertSessionHasErrors('name');
    }

    public function test_merge_moves_products_then_deletes_source(): void
    {
        $staff = $this->makeStaff();
        $both = $this->makeProduct('both', ['Bestseller', 'Best seller']);
        $only = $this->makeProduct('only', ['Bestseller']);
        $source = Tag::query()->where('name', 'Bestseller')->firstOrFail();
        $target = Tag::query()->where('name', 'Best seller')->firstOrFail();

        $this->actingAs($staff, 'staff')
            ->post($this->url('tags/'.$source->rid.'/merge'), ['target_rid' => $target->rid])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertModelMissing($source);
        $this->assertSame(['Best seller'], $both->tags()->pluck('name')->all());
        $this->assertSame(['Best seller'], $only->tags()->pluck('name')->all());
    }

    public function test_merge_into_itself_is_rejected(): void
    {
        $staff = $this->makeStaff();
        $this->makeProduct('one', ['Sale']);
        $tag = Tag::query()->where('name', 'Sale')->firstOrFail();

        $this->actingAs($staff, 'staff')
            ->post($this->url('tags/'.$tag->rid.'/merge'), ['target_rid' => $tag->rid])
            ->assertSessionHasErrors('target_rid');

        $this->assertModelExists($tag);
    }

    public function test_delete_keeps_remaining_tags(): void
    {
        $staff = $this->makeStaff();
        $product = $this->makeProduct('one', ['Sale', 'Limited']);
        $solo = $this->makeProduct('solo', ['Sale']);
        $tag = Tag::query()->where('name', 'Sale')->firstOrFail();

        $this->actingAs($staff, 'staff')
            ->delete($this->url('tags/'.$tag->rid))
            ->assertRedirect();

        $this->assertModelMissing($tag);
        $this->assertSame(['Limited'], $product->refresh()->tags()->pluck('name')->all());
        $this->assertSame([], $solo->refresh()->tags()->pluck('name')->all());
    }

    public function test_product_index_filters_by_tag_category_subtree_and_search(): void
    {
        $staff = $this->makeStaff();
        $parent = Category::query()->create(['slug' => 'fashion', 'label' => 'Fashion']);
        $child = Category::query()->create(['slug' => 'fashion-shoes', 'label' => 'Shoes', 'parent_id' => $parent->id]);
        $this->makeProduct('sneaker', ['Sale'], $child);
        $this->makeProduct('mug', [], null);
        $sale = Tag::query()->where('name', 'Sale')->firstOrFail();

        $this->actingAs($staff, 'staff')
            ->get($this->url('products?tag='.$sale->rid))
            ->assertInertia(fn (Assert $page) => $page
                ->where('products.total', 1)
                ->where('products.data.0.slug', 'sneaker')
                ->where('filters.tag', $sale->rid)
            );

        $this->actingAs($staff, 'staff')
            ->get($this->url('products?category='.$parent->rid))
            ->assertInertia(fn (Assert $page) => $page
                ->where('products.total', 1)
                ->where('products.data.0.categoryPath', 'Fashion / Shoes')
                ->where('products.data.0.shippingClassName', null)
            );

        $this->actingAs($staff, 'staff')
            ->get($this->url('products?q=mug'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('products.total', 1)
                ->where('products.data.0.slug', 'mug')
            );
    }

    private function url(string $path): string
    {
        return '/'.trim((string) config('admin.path_prefix'), '/').'/'.$path;
    }

    /**
     * @param  list<string>  $tags
     */
    private function makeProduct(string $slug, array $tags, ?Category $category = null): Product
    {
        $category ??= Category::query()->firstOrCreate(['slug' => 'misc'], ['label' => 'Misc']);

        $product = Product::query()->create([
            'name' => ucfirst($slug),
            'slug' => $slug,
            'category_id' => $category->id,
            'price_minor' => 1000,
            'currency_code' => 'AED',
        ]);

        $ids = [];
        foreach ($tags as $name) {
            $ids[] = Tag::query()->firstOrCreate(['name' => $name], ['slug' => str($name)->slug()->toString()])->id;
        }
        $product->tags()->sync($ids);

        return $product;
    }

    private function makeStaff(): User
    {
        $this->seed(AdminPermissionsSeeder::class);

        $staff = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-tag-admin@handco.test',
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
