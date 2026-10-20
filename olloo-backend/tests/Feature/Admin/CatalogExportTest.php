<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Tag;
use App\Models\User;
use App\Services\ProductImport\ProductCsvImporter;
use Database\Seeders\AdminPermissionsSeeder;
use Database\Seeders\CurrencySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Products and categories leave the admin as CSV. The product file uses the
 * import columns, so the rule that matters is the round trip: exporting and
 * importing the file back must change nothing.
 */
final class CatalogExportTest extends TestCase
{
    use RefreshDatabase;

    private Category $men;

    protected function setUp(): void
    {
        parent::setUp();
        config(['admin.mfa_forced' => false]);
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);

        $fashion = Category::query()->create(['slug' => 'fashion', 'label' => 'Fashion', 'sort_order' => 1, 'is_active' => true]);
        $this->men = Category::query()->create(['slug' => 'fashion-men', 'label' => 'Men', 'parent_id' => $fashion->id, 'is_active' => true, 'return_window_days' => 14]);
        Category::query()->create(['slug' => 'electronics', 'label' => 'Electronics', 'sort_order' => 0, 'is_active' => false]);
    }

    public function test_products_export_in_the_import_format_with_one_row_per_option(): void
    {
        $tee = $this->product('Classic Tee', 'classic-tee', ['Summer', 'Bestseller']);
        ProductVariant::query()->create(['product_id' => $tee->id, 'name' => 'Black / M', 'color' => 'Black', 'size' => 'M', 'sku' => 'TEE-BLK-M', 'stock_quantity' => 10, 'is_default' => true]);
        ProductVariant::query()->create(['product_id' => $tee->id, 'name' => 'Black / L', 'color' => 'Black', 'size' => 'L', 'sku' => 'TEE-BLK-L', 'price_minor' => 2700, 'stock_quantity' => null, 'handling_days' => 3, 'is_default' => false]);

        $rows = $this->csv($this->actingAs($this->staff(['view_products']), 'staff')
            ->get($this->url('products/export'))
            ->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8')
            ->streamedContent());

        $this->assertSame(array_keys(ProductCsvImporter::COLUMNS), $rows[0]);
        $this->assertCount(3, $rows);

        $first = array_combine($rows[0], $rows[1]);
        $this->assertSame('classic-tee', $first['slug']);
        $this->assertSame('fashion-men', $first['category']);
        $this->assertSame('25.00', $first['price']);
        $this->assertSame('30.00', $first['original_price']);
        $this->assertSame('Summer;Bestseller', $first['tags']);
        $this->assertSame('yes', $first['visible']);
        $this->assertSame('Soft cotton|Regular fit', $first['description']);
        $this->assertSame('TEE-BLK-M', $first['sku']);
        $this->assertSame('', $first['variant_price']);
        $this->assertSame('10', $first['stock_quantity']);

        // The second option repeats the store link and carries only option columns.
        $second = array_combine($rows[0], $rows[2]);
        $this->assertSame('classic-tee', $second['slug']);
        $this->assertSame('', $second['price']);
        $this->assertSame('', $second['category']);
        $this->assertSame('TEE-BLK-L', $second['sku']);
        $this->assertSame('27.00', $second['variant_price']);
        $this->assertSame('', $second['stock_quantity']);
        $this->assertSame('3', $second['variant_handling_days']);
    }

    public function test_an_exported_file_imports_back_without_changing_anything(): void
    {
        $tee = $this->product('Classic Tee', 'classic-tee', ['Summer']);
        ProductVariant::query()->create(['product_id' => $tee->id, 'name' => 'Black / M', 'color' => 'Black', 'size' => 'M', 'sku' => 'TEE-BLK-M', 'stock_quantity' => 10, 'is_default' => true]);
        ProductVariant::query()->create(['product_id' => $tee->id, 'name' => 'White / M', 'color' => 'White', 'size' => 'M', 'sku' => 'TEE-WHT-M', 'price_minor' => 2600, 'is_default' => false]);
        // A name that would run as a formula in a spreadsheet.
        $formula = $this->product('=HYPERLINK("x")', 'formula-product', []);
        ProductVariant::query()->create(['product_id' => $formula->id, 'name' => 'Standard', 'sku' => 'FORMULA-1', 'is_default' => true]);

        $csv = $this->actingAs($this->staff(['view_products']), 'staff')
            ->get($this->url('products/export'))
            ->streamedContent();

        $this->assertStringContainsString("'=HYPERLINK", $csv);

        $plans = app(ProductCsvImporter::class)->plan($csv);

        $this->assertCount(2, $plans);
        foreach ($plans as $plan) {
            $this->assertSame([], $plan['errors'], $plan['name']);
            $this->assertSame('update', $plan['action'], $plan['name']);
            $this->assertSame([], $plan['changes'], $plan['name']);
        }
        $this->assertSame('=HYPERLINK("x")', $plans[1]['values']['name']);
        $this->assertSame(['TEE-BLK-M', 'TEE-WHT-M'], array_column($plans[0]['variants'], 'sku'));
    }

    public function test_an_edited_option_in_the_exported_file_still_shows_as_a_change(): void
    {
        $tee = $this->product('Classic Tee', 'classic-tee', []);
        ProductVariant::query()->create(['product_id' => $tee->id, 'name' => 'Black / M', 'sku' => 'TEE-BLK-M', 'stock_quantity' => 10, 'is_default' => true]);

        $csv = $this->actingAs($this->staff(['view_products']), 'staff')
            ->get($this->url('products/export'))
            ->streamedContent();
        $rows = $this->csv($csv);
        $stock = array_search('stock_quantity', $rows[0], true);
        $rows[1][$stock] = '4';
        $edited = implode("\n", array_map(static fn (array $row): string => implode(',', array_map(static fn (string $cell): string => '"'.str_replace('"', '""', $cell).'"', $row)), $rows));

        $changes = app(ProductCsvImporter::class)->plan($edited)[0]['changes'];

        $this->assertSame([[
            'field' => 'Option',
            'from' => 'Black / M (TEE-BLK-M), 10 in stock',
            'to' => 'Black / M (TEE-BLK-M), 4 in stock',
        ]], $changes);
    }

    public function test_the_export_holds_what_the_list_is_filtered_to(): void
    {
        $shown = $this->product('Shown tee', 'shown-tee', []);
        ProductVariant::query()->create(['product_id' => $shown->id, 'name' => 'Standard', 'sku' => 'SHOWN', 'is_default' => true]);
        $hidden = $this->product('Hidden tee', 'hidden-tee', [], active: false);
        ProductVariant::query()->create(['product_id' => $hidden->id, 'name' => 'Standard', 'sku' => 'HIDDEN', 'is_default' => true]);

        $csv = $this->actingAs($this->staff(['view_products']), 'staff')
            ->get($this->url('products/export?status=inactive'))
            ->streamedContent();

        $this->assertStringContainsString('hidden-tee', $csv);
        $this->assertStringNotContainsString('shown-tee', $csv);
    }

    public function test_categories_export_in_tree_order(): void
    {
        $tee = $this->product('Classic Tee', 'classic-tee', []);
        ProductVariant::query()->create(['product_id' => $tee->id, 'name' => 'Standard', 'sku' => 'TEE', 'is_default' => true]);

        $rows = $this->csv($this->actingAs($this->staff(['view_categories']), 'staff')
            ->get($this->url('categories/export'))
            ->assertOk()
            ->streamedContent());

        $this->assertSame(['slug', 'label', 'parent', 'path', 'visible', 'sort_order', 'returnable', 'return_window_days', 'image', 'products'], $rows[0]);
        $this->assertSame(['electronics', 'fashion', 'fashion-men'], array_column(array_slice($rows, 1), 0));

        $men = array_combine($rows[0], $rows[3]);
        $this->assertSame('fashion', $men['parent']);
        $this->assertSame('Fashion / Men', $men['path']);
        $this->assertSame('14', $men['return_window_days']);
        $this->assertSame('1', $men['products']);
        $this->assertSame('no', array_combine($rows[0], $rows[1])['visible']);
    }

    public function test_exports_need_the_view_permission(): void
    {
        $staff = $this->staff([]);

        $this->actingAs($staff, 'staff')->get($this->url('products/export'))->assertForbidden();
        $this->actingAs($staff, 'staff')->get($this->url('categories/export'))->assertForbidden();
    }

    /**
     * @param  list<string>  $tags
     */
    private function product(string $name, string $slug, array $tags, bool $active = true): Product
    {
        $product = Product::query()->create([
            'name' => $name,
            'slug' => $slug,
            'category_id' => $this->men->id,
            'price_minor' => 2500,
            'original_price_minor' => 3000,
            'currency_code' => 'USD',
            'description_lines' => ['Soft cotton', 'Regular fit'],
            'image' => '/images/products/'.$slug.'.jpg',
            'is_active' => $active,
        ]);

        $product->syncTagsInOrder(array_map(
            fn (string $tag): int => Tag::query()->firstOrCreate(['name' => $tag], ['slug' => strtolower($tag)])->id,
            $tags,
        ));

        return $product;
    }

    /**
     * @return list<list<string>>
     */
    private function csv(string $contents): array
    {
        $lines = preg_split('/\r?\n/', trim(preg_replace('/^\xEF\xBB\xBF/', '', $contents) ?? $contents)) ?: [];

        return array_map(static fn (string $line): array => str_getcsv($line), $lines);
    }

    private function url(string $path): string
    {
        return '/'.trim((string) config('admin.path_prefix'), '/').'/'.$path;
    }

    /**
     * @param  list<string>  $permissions
     */
    private function staff(array $permissions): User
    {
        $staff = User::query()->create([
            'name' => 'Admin',
            'email' => 'exports@handco.test',
            'password' => 'password',
            'user_type' => 'staff',
            'email_verified_at' => now(),
            'must_change_password' => false,
            'two_factor_enabled' => false,
        ]);
        $staff->syncPermissions($permissions);

        return $staff;
    }
}
