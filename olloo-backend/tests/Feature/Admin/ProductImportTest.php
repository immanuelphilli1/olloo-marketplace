<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Jobs\ImportProductImages;
use App\Jobs\ImportProductsFromCsv;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImport;
use App\Models\ProductVariant;
use App\Models\Tag;
use App\Models\User;
use Database\Seeders\AdminPermissionsSeeder;
use Database\Seeders\CurrencySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use RuntimeException;
use Tests\TestCase;

/**
 * Staff adding products from a spreadsheet and photos from a zip. The rules
 * that matter here are that nothing saves during the preview, money is never
 * guessed, and an image file name resolves to exactly the product it names.
 */
final class ProductImportTest extends TestCase
{
    use RefreshDatabase;

    private string $prefix;

    protected function setUp(): void
    {
        parent::setUp();
        config(['admin.mfa_forced' => false]);
        $this->prefix = trim((string) config('admin.path_prefix'), '/');
        Storage::fake('public');
        Storage::fake('local');
    }

    public function test_the_template_has_the_documented_columns_and_an_example_row(): void
    {
        $this->actingAs($this->staff(), 'staff')
            ->get('/'.$this->prefix.'/products-import/template')
            ->assertOk()
            ->assertHeader('content-disposition', 'attachment; filename="product-import-template.csv"');

        $template = (string) $this->actingAs($this->staff(), 'staff')
            ->get('/'.$this->prefix.'/products-import/template')
            ->getContent();

        $header = str_getcsv((string) strtok((string) $template, "\n"), ',');
        // A BOM precedes the first header so Excel reads UTF-8 names correctly.
        $this->assertSame('name', ltrim((string) $header[0], "\xEF\xBB\xBF"));
        $this->assertContains('sku', $header);
        $this->assertContains('price', $header);
        $this->assertStringContainsString('Cotton crew t-shirt', $template);
    }

    /**
     * A large file takes far longer than a request should hold a worker, so the
     * writing happens on the queue and the button press returns immediately.
     */
    public function test_applying_queues_the_work_instead_of_writing_in_the_request(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->category();
        Queue::fake();

        $token = $this->previewToken("name,slug,category,price,sku,visible\n"
            ."Blue shirt,blue-shirt,Apparel,19.99,SHIRT-BLUE,yes\n");

        $response = $this->applyCsv($token);
        $response->assertRedirect();
        $response->assertSessionHas('success');

        Queue::assertPushed(ImportProductsFromCsv::class, function (ImportProductsFromCsv $job): bool {
            return $job->productImportId > 0 && $job->plans !== [];
        });

        $this->assertSame(0, Product::query()->count(), 'A queued import must not write in the request.');
        $this->assertSame(ProductImport::QUEUED, $this->latestImport()->status);
    }

    public function test_the_photo_apply_is_queued_too(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->existingProduct();
        Queue::fake();

        $token = $this->previewImages($this->zip(['main-blue-shirt.jpg' => 'bytes']));

        $this->applyImages($token)->assertRedirect();

        Queue::assertPushed(ImportProductImages::class, function (ImportProductImages $job): bool {
            return $job->productImportId > 0 && $job->archive !== '';
        });

        $this->assertNull(Product::query()->where('slug', 'blue-shirt')->firstOrFail()->image);
    }

    /**
     * A run the queue worker could not finish must read as failed, never as a
     * clean zero-row success.
     */
    public function test_a_run_that_dies_is_recorded_as_failed(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->category();

        $token = $this->previewToken("name,slug,category,price,sku,visible\n"
            ."Blue shirt,blue-shirt,Apparel,19.99,SHIRT-BLUE,yes\n");

        $run = $this->applyCsvAndRun($token);
        $run->forceFill(['status' => ProductImport::RUNNING])->save();

        (new ImportProductsFromCsv($run->id, []))->failed(new RuntimeException('Worker died.'));

        $run->refresh();
        $this->assertSame(ProductImport::FAILED, $run->status);
        $this->assertStringContainsString('stopped before it finished', (string) $run->error);
    }

    /** The outcome is readable afterwards, so a closed tab loses nothing. */
    public function test_the_report_survives_for_later(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->category();

        $token = $this->previewToken("name,slug,category,price,sku,visible\n"
            ."Blue shirt,blue-shirt,Apparel,19.99,SHIRT-BLUE,yes\n"
            ."Broken Row,broken-row,Apparel,not a number,BRK-1,no\n");

        $run = $this->applyCsvAndRun($token);

        $this->assertSame(1, $run->created_count);
        $this->assertSame(1, $run->skipped_count);
        $this->assertSame(ProductImport::DONE, $run->status);

        $show = $this->actingAs($this->staff(), 'staff')
            ->get($this->prefix.'/product-imports/'.$run->rid)
            ->assertOk();
        $props = $this->props($show);

        $this->assertSame('1 created, 1 skipped', $props['import']['summary']);
        $this->assertCount(2, $props['import']['report']);

        // And it is listed for the next person who asks "did that go through?".
        $index = $this->props(
            $this->actingAs($this->staff(), 'staff')->get($this->prefix.'/product-imports')->assertOk()
        );
        $this->assertSame($run->rid, $index['imports'][0]['rid']);
    }

    public function test_preview_creates_nothing(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->category();

        $this->postCsv('name,slug,category,price,sku,visible,stock_quantity'."\n"
            .'Blue shirt,blue-shirt,Apparel,49.99,SHIRT-BLUE,yes,10'."\n")
            ->assertRedirect();

        $this->assertSame(0, Product::query()->count(), 'A preview must never write to the catalog.');
    }

    public function test_applying_a_valid_row_creates_the_product_with_its_option(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->category();

        $token = $this->previewToken('name,slug,category,price,sku,visible,stock_quantity,description'."\n"
            .'Blue shirt,blue-shirt,Apparel,49.99,SHIRT-BLUE,yes,10,Soft cotton|Washes well'."\n");

        $run = $this->applyCsvAndRun($token);

        $this->assertSame(ProductImport::DONE, $run->status);
        $this->assertSame(1, $run->created_count);

        $product = Product::query()->where('slug', 'blue-shirt')->firstOrFail();

        $this->assertSame('Blue shirt', $product->name);
        $this->assertSame(4999, $product->price_minor);
        $this->assertTrue($product->is_active);
        $this->assertSame(['Soft cotton', 'Washes well'], $product->description_lines);

        $variant = $product->defaultVariant;
        $this->assertSame('SHIRT-BLUE', $variant->sku);
        $this->assertSame(10, $variant->stock_quantity);
        $this->assertTrue($variant->is_default);
    }

    /**
     * Extra rows sharing a store link are more sizes or colours of one product,
     * which is how shop staff already think about it.
     */
    public function test_rows_sharing_a_store_link_become_options_of_one_product(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->category();

        $token = $this->previewToken('name,slug,category,price,sku,variant_name,size,stock_quantity,visible'."\n"
            .'Blue shirt,blue-shirt,Apparel,49.99,SHIRT-S,Small,S,4,yes'."\n"
            .',blue-shirt,,,SHIRT-M,Medium,M,7,'."\n"
            .',blue-shirt,,,SHIRT-L,Large,L,0,'."\n");

        $this->applyCsv($token)->assertRedirect();

        $product = Product::query()->where('slug', 'blue-shirt')->firstOrFail();

        $this->assertSame(3, $product->variants()->count());
        $this->assertSame(
            ['SHIRT-S', 'SHIRT-M', 'SHIRT-L'],
            $product->variants()->orderBy('id')->pluck('sku')->all(),
        );
        // Exactly one default, and it is a real one.
        $this->assertSame(1, $product->variants()->where('is_default', true)->count());
        $this->assertSame('SHIRT-S', $product->defaultVariant->sku);
    }

    /**
     * Two products in one file must stay two products: a second store link
     * starts a new one, it is not folded into the row above it.
     */
    public function test_a_second_product_in_the_same_file_is_not_folded_into_the_first(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->category();

        $token = $this->previewToken(
            "name,slug,category,price,sku,visible,stock_quantity\n"
            ."Blue shirt,blue-shirt,Apparel,19.99,SHIRT-BLUE,yes,5\n"
            .",blue-shirt,,,SHIRT-BLUE-M,,,,3\n"
            ."Red shirt,red-shirt,Apparel,19.99,SHIRT-RED,yes,4\n"
        );

        $props = $this->props($this->get($this->prefix.'/products-import/'.$token));

        $this->assertSame(2, count($props['rows']));
        $this->assertSame('Blue shirt', $props['rows'][0]['name']);
        $this->assertCount(2, $props['rows'][0]['variants']);
        $this->assertSame('Red shirt', $props['rows'][1]['name']);
        $this->assertCount(1, $props['rows'][1]['variants']);

        $this->applyCsv($token)->assertRedirect();

        $this->assertSame(2, Product::query()->count());
        $this->assertSame(2, Product::query()->where('slug', 'blue-shirt')->firstOrFail()->variants()->count());
        $this->assertSame(1, Product::query()->where('slug', 'red-shirt')->firstOrFail()->variants()->count());
    }

    public function test_a_blank_line_in_the_spreadsheet_is_not_a_product(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->category();

        $token = $this->previewToken(
            "name,slug,category,price,sku,visible,stock_quantity\n"
            ."Blue shirt,blue-shirt,Apparel,19.99,SHIRT-BLUE,yes,5\n"
            .",,,,,,,,\n"
        );

        $props = $this->props($this->get($this->prefix.'/products-import/'.$token));

        $this->assertSame(1, count($props['rows']));
    }

    public function test_a_row_without_a_price_is_rejected_rather_than_imported_free(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->category();

        $token = $this->previewToken("name,slug,category,price,sku\nFree thing,free-thing,Apparel,,FREE-1\n");

        $props = $this->props($this->get($this->prefix.'/products-import/'.$token));
        $this->assertSame('invalid', $props['rows'][0]['action']);
        $this->assertStringContainsString('No price given', implode(' ', $props['rows'][0]['errors']));

        $this->applyCsv($token);

        $this->assertSame(0, Product::query()->count());
    }

    public function test_a_price_that_is_not_a_number_is_rejected(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->category();

        $token = $this->previewToken("name,slug,category,price,sku\nOdd price,odd-price,Apparel,about forty,ODD-1\n");

        $props = $this->props($this->get($this->prefix.'/products-import/'.$token));

        $this->assertSame('invalid', $props['rows'][0]['action']);
        $this->assertStringContainsString('is not a number', implode(' ', $props['rows'][0]['errors']));
    }

    public function test_an_unknown_category_is_reported_not_created(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);

        $token = $this->previewToken("name,slug,category,price,sku\nGhost,ghost-nowhere,Nowhere,10.00,GHOST-1\n");

        $props = $this->props($this->get($this->prefix.'/products-import/'.$token));

        $this->assertSame('invalid', $props['rows'][0]['action']);
        $this->assertStringContainsString('No category called "Nowhere"', implode(' ', $props['rows'][0]['errors']));
    }

    public function test_a_matching_row_is_only_updated_when_staff_say_so(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->category();
        $existing = $this->existingProduct();

        $token = $this->previewToken("name,slug,category,price,sku,visible\n"
            ."Blue shirt,blue-shirt,Apparel,79.00,SHIRT-BLUE,yes\n");

        $props = $this->props($this->get($this->prefix.'/products-import/'.$token));
        $this->assertSame('update', $props['rows'][0]['action']);
        $this->assertSame('Matches an existing store link', $props['rows'][0]['matchedBy']);

        // Skip: the row is read, matched and reported, but nothing is written.
        $this->applyCsv($token, [$props['rows'][0]['index'] => 'skip'])->assertRedirect();
        $this->assertSame(1999, $existing->fresh()->price_minor);

        // Update: the same file, uploaded again, now changes it. A preview is
        // used once, so re-uploading is how a staff member retries.
        $token = $this->previewToken("name,slug,category,price,sku,visible\n"
            ."Blue shirt,blue-shirt,Apparel,79.00,SHIRT-BLUE,yes\n");
        $this->applyCsv($token, [$this->firstIndex($token) => 'update'])->assertRedirect();
        $this->assertSame(7900, $existing->fresh()->price_minor);
    }

    /**
     * A matched row with no decision must not fall back to a guess: overwriting
     * a live product is the worst possible outcome of a bulk upload.
     */
    public function test_a_matched_row_with_no_choice_is_refused(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->category();
        $existing = $this->existingProduct();

        $token = $this->previewToken("name,slug,category,price,sku\n"
            ."Blue shirt,blue-shirt,Apparel,79.00,SHIRT-BLUE\n");

        $this->applyCsv($token)->assertSessionHasErrors('choices');

        $this->assertSame(1999, $existing->fresh()->price_minor);
    }

    public function test_staff_without_edit_permission_cannot_overwrite_an_existing_product(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->category();
        $existing = $this->existingProduct();

        $staff = $this->staff();
        $staff->syncPermissions(array_values(array_diff(
            AdminPermissionsSeeder::PERMISSIONS,
            ['edit_products'],
        )));
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);

        $token = $this->previewToken("name,slug,category,price,sku\n"
            ."Blue shirt,blue-shirt,Apparel,79.00,SHIRT-BLUE\n", $staff);

        $props = $this->props($this->actingAs($staff, 'staff')->get($this->prefix.'/products-import/'.$token));

        $this->actingAs($staff, 'staff')
            ->post($this->prefix.'/products-import/'.$token.'/apply', [
                'choices' => [$props['rows'][0]['index'] => 'update'],
            ])
            ->assertSessionHasErrors('choices');

        $this->assertSame(1999, $existing->fresh()->price_minor);
    }

    public function test_a_row_is_matched_by_sku_even_when_the_store_link_differs(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->category();
        $existing = $this->existingProduct();

        $token = $this->previewToken("name,slug,category,price,sku\n"
            ."Blue shirt renamed,blue-shirt-v2,Apparel,55.00,SHIRT-BLUE\n");

        $props = $this->props($this->get($this->prefix.'/products-import/'.$token));

        $this->assertSame('update', $props['rows'][0]['action']);
        $this->assertSame('Matches the SKU of an existing option', $props['rows'][0]['matchedBy']);

        $this->applyCsv($token, [$props['rows'][0]['index'] => 'update'])->assertRedirect();

        $this->assertSame('Blue shirt renamed', $existing->fresh()->name);
    }

    /**
     * A first row whose SKU belongs to another product is an update of that
     * product, which is the documented SKU matching rule. The collision that
     * must be refused is on a later row, where the product is already decided
     * and the SKU would silently steal another product's option.
     */
    public function test_a_second_row_using_another_products_sku_is_rejected(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->category();
        $this->existingProduct();

        $token = $this->previewToken("name,slug,category,price,sku\n"
            ."Copycat,copycat,Apparel,10.00,COPYCAT-S\n"
            .',copycat,,,SHIRT-BLUE'."\n");

        $props = $this->props($this->get($this->prefix.'/products-import/'.$token));

        $this->assertSame('invalid', $props['rows'][0]['action']);
        $this->assertStringContainsString(
            'Another product already uses the SKU SHIRT-BLUE',
            implode(' ', $props['rows'][0]['errors']),
        );
    }

    public function test_the_preview_says_which_fields_change(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->category();
        $this->existingProduct();

        $token = $this->previewToken("name,slug,category,price,sku,featured\n"
            ."Blue shirt,blue-shirt,Apparel,29.50,SHIRT-BLUE,yes\n");

        $changes = collect($this->props($this->get($this->prefix.'/products-import/'.$token))['rows'][0]['changes'])
            ->keyBy('field');

        $this->assertSame('19.99 AED', $changes['Price']['from']);
        $this->assertSame('29.50 AED', $changes['Price']['to']);
        $this->assertSame('No', $changes['Featured']['from']);
        $this->assertSame('Yes', $changes['Featured']['to']);
    }

    public function test_a_blank_tags_column_leaves_existing_tags_alone(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->category();
        $existing = $this->existingProduct();
        $existing->tags()->attach(Tag::query()->create(['name' => 'Summer', 'slug' => 'summer'])->id);

        $token = $this->previewToken("name,slug,category,price,sku,tags\n"
            ."Blue shirt,blue-shirt,Apparel,19.99,SHIRT-BLUE,\n");

        $this->applyCsv($token, [$this->firstIndex($token) => 'update'])->assertRedirect();

        $this->assertSame(['Summer'], $existing->fresh()->tags()->pluck('name')->all());
    }

    public function test_given_tags_replace_the_existing_ones(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->category();
        $existing = $this->existingProduct();
        $existing->tags()->attach(Tag::query()->create(['name' => 'Summer', 'slug' => 'summer'])->id);

        $token = $this->previewToken("name,slug,category,price,sku,tags\n"
            ."Blue shirt,blue-shirt,Apparel,19.99,SHIRT-BLUE,Winter;Clearance\n");

        $this->applyCsv($token, [$this->firstIndex($token) => 'update'])->assertRedirect();

        $this->assertEqualsCanonicalizing(
            ['Winter', 'Clearance'],
            $existing->fresh()->tags()->pluck('name')->all(),
        );
    }

    public function test_an_image_file_named_after_the_store_link_becomes_the_main_photo(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->existingProduct();

        $zip = $this->zip(['main-blue-shirt.jpg' => 'main-photo-bytes']);
        $token = $this->previewImages($zip);

        $props = $this->props($this->get($this->prefix.'/product-images-import/'.$token));
        $this->assertSame(1, $props['summary']['matched']);
        $this->assertSame('main', $props['files'][0]['role']);
        $this->assertSame('store link', $props['files'][0]['matchedBy']);

        $this->applyImages($token)->assertRedirect();

        $product = Product::query()->where('slug', 'blue-shirt')->firstOrFail();
        $this->assertNotNull($product->image);
        Storage::disk('public')->assertExists(ltrim((string) $product->image, '/storage/'));
    }

    public function test_a_sub_prefixed_file_joins_the_gallery_without_touching_the_main_photo(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $product = $this->existingProduct();
        $product->update(['image' => '/storage/existing.jpg']);

        $token = $this->previewImages($this->zip(['sub-blue-shirt.jpg' => 'gallery-bytes']));

        $this->applyImages($token)->assertRedirect();

        $product->refresh();
        $this->assertSame('/storage/existing.jpg', $product->image);
        $this->assertSame(1, $product->images()->count());
    }

    public function test_a_file_can_be_matched_by_any_of_its_option_skus(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->existingProduct();

        $token = $this->previewImages($this->zip(['main-SHIRT-BLUE.jpg' => 'bytes']));
        $props = $this->props($this->get($this->prefix.'/product-images-import/'.$token));

        $this->assertSame(1, $props['summary']['matched']);
        $this->assertSame('SKU', $props['files'][0]['matchedBy']);

        // The same identifier without the prefix still resolves to the product.
        $unprefixed = $this->previewImages($this->zip(['SHIRT-BLUE.jpg' => 'bytes']));
        $this->assertSame(
            1,
            $this->props($this->get($this->prefix.'/product-images-import/'.$unprefixed))['summary']['matched'],
        );

        // Something that matches nothing is reported rather than applied.
        $unmatched = $this->previewImages($this->zip(['main-navy-jacket.jpg' => 'bytes']));
        $this->assertSame(
            1,
            $this->props($this->get($this->prefix.'/product-images-import/'.$unmatched))['summary']['unmatched'],
        );

        $this->applyImages($token)->assertRedirect();
        $this->assertNotNull(Product::query()->where('slug', 'blue-shirt')->firstOrFail()->image);
    }

    public function test_an_unmatched_file_is_reported_and_skipped(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->existingProduct();

        $token = $this->previewImages($this->zip(['main-nothing-like-this.jpg' => 'bytes']));
        $props = $this->props($this->get($this->prefix.'/product-images-import/'.$token));

        $this->assertSame(1, $props['summary']['unmatched']);
        $this->assertStringContainsString('No product matches', $props['files'][0]['note']);

        $this->applyImages($token)->assertRedirect();

        $this->assertSame(0, Product::query()->whereNotNull('image')->count());
    }

    /**
     * With no prefix and no decision, the file must not be applied on a guess.
     * The preview says so and the apply step skips it.
     */
    public function test_an_unprefixed_file_is_skipped_until_staff_choose(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->existingProduct();

        $token = $this->previewImages($this->zip(['blue-shirt.jpg' => 'bytes']));
        $props = $this->props($this->get($this->prefix.'/product-images-import/'.$token));

        $this->assertSame('undecided', $props['files'][0]['role']);
        $this->assertSame('main', $props['files'][0]['suggestedRole'], 'A product with no photo suggests main.');
        $this->assertSame(1, $props['summary']['undecided']);

        $this->applyImages($token)->assertRedirect();

        // The skip is reported on the run, which is where the outcome now lives.
        $run = $this->latestImport();
        $this->assertSame(ProductImport::DONE, $run->status);
        $this->assertSame(1, $run->skipped_count);
        $this->assertStringContainsString('did not choose a role', (string) $run->report[0]['note']);

        $this->assertNull(Product::query()->where('slug', 'blue-shirt')->firstOrFail()->image);
    }

    public function test_staff_can_choose_a_role_for_an_unprefixed_file(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $product = $this->existingProduct();
        $product->update(['image' => '/storage/existing.jpg']);

        $token = $this->previewImages($this->zip(['blue-shirt.jpg' => 'bytes']));

        $this->applyImages($token, ['blue-shirt.jpg' => 'sub'])->assertRedirect();

        $this->assertSame('/storage/existing.jpg', $product->fresh()->image);
        $this->assertSame(1, $product->fresh()->images()->count());
    }

    public function test_creating_products_needs_create_permission_and_images_need_edit(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);

        $viewer = $this->staff();
        $viewer->syncPermissions(['view_products']);

        $this->actingAs($viewer, 'staff')->get($this->prefix.'/products-import')->assertForbidden();
        $this->actingAs($viewer, 'staff')->get($this->prefix.'/product-images-import')->assertForbidden();
    }

    public function test_an_unknown_preview_token_is_not_found(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);

        $this->actingAs($this->staff(), 'staff')
            ->get($this->prefix.'/products-import/not-a-real-token')
            ->assertNotFound();
    }

    private function category(): Category
    {
        return Category::query()->firstOrCreate(
            ['slug' => 'apparel'],
            ['label' => 'Apparel'],
        );
    }

    private function existingProduct(): Product
    {
        $category = $this->category();

        $product = Product::query()->create([
            'name' => 'Blue shirt',
            'slug' => 'blue-shirt',
            'category_id' => $category->id,
            'price_minor' => 1999,
            'currency_code' => 'AED',
            'is_active' => true,
            'description_lines' => ['Soft cotton'],
        ]);

        ProductVariant::query()->create([
            'product_id' => $product->id,
            'name' => 'Standard',
            'sku' => 'SHIRT-BLUE',
            'stock_quantity' => 5,
            'is_default' => true,
        ]);

        return $product;
    }

    /**
     * Cached per test: the helpers below call this repeatedly, and
     * active_email is unique across live staff accounts.
     */
    private ?User $staff = null;

    private function staff(): User
    {
        if ($this->staff instanceof User) {
            return $this->staff;
        }

        $this->seed(AdminPermissionsSeeder::class);

        $staff = User::query()->create([
            'name' => 'Importer',
            'email' => 'import@handco.test',
            'password' => 'password',
            'user_type' => 'staff',
            'email_verified_at' => now(),
            'must_change_password' => false,
            'two_factor_enabled' => false,
        ]);

        $staff->syncPermissions(AdminPermissionsSeeder::PERMISSIONS);

        return $this->staff = $staff;
    }

    private function postCsv(string $contents): TestResponse
    {
        return $this->actingAs($this->staff(), 'staff')->post($this->prefix.'/products-import', [
            'csv' => UploadedFile::fake()->createWithContent('products.csv', $contents),
        ]);
    }

    private function previewToken(string $contents, ?User $staff = null): string
    {
        $response = $this->actingAs($staff ?? $this->staff(), 'staff')->post($this->prefix.'/products-import', [
            'csv' => UploadedFile::fake()->createWithContent('products.csv', $contents),
        ]);

        $response->assertRedirect();

        return basename((string) parse_url((string) $response->headers->get('Location'), PHP_URL_PATH));
    }

    private function firstIndex(string $token): int
    {
        return $this->props($this->get($this->prefix.'/products-import/'.$token))['rows'][0]['index'];
    }

    private function applyCsv(string $token, array $choices = []): TestResponse
    {
        return $this->actingAs($this->staff(), 'staff')
            ->post($this->prefix.'/products-import/'.$token.'/apply', ['choices' => $choices]);
    }

    /**
     * Apply and run the queued job, which is what the sync queue does for us in
     * tests. Returns the finished run so a test can read its report.
     */
    private function applyCsvAndRun(string $token, array $choices = []): ProductImport
    {
        $response = $this->applyCsv($token, $choices);
        $response->assertRedirect();

        return $this->latestImport();
    }

    public function test_images_inside_a_zipped_folder_are_saved(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $this->existingProduct();

        // Zipping a folder on Windows or macOS puts every file under its name.
        $token = $this->previewImages($this->zip(['factory-photos/main-blue-shirt.jpg' => 'bytes']));
        $this->applyImages($token)->assertRedirect();

        $product = Product::query()->where('slug', 'blue-shirt')->firstOrFail();
        $this->assertNotNull($product->image);
        Storage::disk('public')->assertExists(ltrim((string) $product->image, '/storage/'));
    }

    public function test_numbered_photos_of_one_product_all_join_the_gallery(): void
    {
        $this->seed([AdminPermissionsSeeder::class, CurrencySeeder::class]);
        $product = $this->existingProduct();

        $token = $this->previewImages($this->zip([
            'main-SHIRT-BLUE.jpg' => 'main',
            'sub-SHIRT-BLUE-1.jpg' => 'a',
            'sub-SHIRT-BLUE_2.jpg' => 'b',
            'sub-SHIRT-BLUE (3).jpg' => 'c',
        ]));
        $this->assertSame(4, $this->props($this->get($this->prefix.'/product-images-import/'.$token))['summary']['matched']);

        $this->applyImages($token)->assertRedirect();

        $this->assertSame(4, $product->refresh()->images()->count());
    }

    private function latestImport(): ProductImport
    {
        return ProductImport::query()->latest('id')->firstOrFail();
    }

    /**
     * @param  array<string, string>  $files
     */
    private function zip(array $files): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'import').'.zip';

        $archive = new \ZipArchive;
        $archive->open($path, \ZipArchive::CREATE | \ZipArchive::OVERWRITE);
        foreach ($files as $name => $contents) {
            $archive->addFromString($name, $contents);
        }
        $archive->close();

        return new UploadedFile($path, 'images.zip', 'application/zip', null, true);
    }

    private function previewImages(UploadedFile $zip): string
    {
        $response = $this->actingAs($this->staff(), 'staff')->post($this->prefix.'/product-images-import', [
            'images' => $zip,
        ]);

        $response->assertRedirect();

        return basename((string) parse_url((string) $response->headers->get('Location'), PHP_URL_PATH));
    }

    private function applyImages(string $token, array $choices = []): TestResponse
    {
        return $this->actingAs($this->staff(), 'staff')
            ->post($this->prefix.'/product-images-import/'.$token.'/apply', ['choices' => $choices]);
    }

    /**
     * @return array<string, mixed>
     */
    private function props($response): array
    {
        return $response->viewData('page')['props'];
    }
}
