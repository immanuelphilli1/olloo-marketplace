<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\CategoryAttribute;
use App\Models\Currency;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use App\Models\ShippingClass;
use App\Models\Tag;
use App\Services\ProductImport\ProductCsvExporter;
use App\Services\ProductImport\ProductCsvImporter;
use App\Support\CategoryForest;
use App\Support\CsvExport;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductController extends Controller
{
    private const STATUS_FILTERS = ['active', 'inactive', 'featured', 'new_arrival'];

    public function index(Request $request): Response
    {
        abort_unless($request->user('staff')->can('view_products'), 403);

        $forest = CategoryForest::load();
        [$query, $filters] = $this->filtered($request, $forest);

        $products = $query
            ->with(['category:id,rid,label,parent_id', 'tags:id,rid,name', 'shippingClass:id,rid,name', 'defaultVariant'])
            ->latest()
            ->paginate((int) config('admin.per_page'))
            ->withQueryString()
            ->through(fn (Product $product) => [
                ...$this->serializeProduct($product),
                'categoryPath' => $product->category ? $forest->pathLabel($product->category) : null,
            ]);

        return Inertia::render('Admin/Products/Index', [
            'products' => $products,
            'filters' => $filters,
            'categoryTree' => $forest->pickerNodes(),
            'tags' => Tag::query()->orderBy('name')->get(['rid', 'name'])->map->only(['rid', 'name'])->values(),
            // For "View in shop": the public product page is <storefront>/products/<rid>.
            'storefrontUrl' => rtrim((string) config('services.storefront.url'), '/') ?: null,
        ]);
    }

    /**
     * The products the list is showing (same filters), as a CSV in the import
     * format: edit it in a spreadsheet and bring it back through "Add from
     * spreadsheet".
     */
    public function export(Request $request, ProductCsvExporter $exporter): StreamedResponse
    {
        abort_unless($request->user('staff')->can('view_products'), 403);

        [$query] = $this->filtered($request, CategoryForest::load());

        return CsvExport::download(
            'products-'.now()->format('Y-m-d').'.csv',
            array_keys(ProductCsvImporter::COLUMNS),
            $exporter->rows($query),
        );
    }

    /**
     * The list's filters as a query, shared by the page and the export so the
     * file always holds what staff were looking at.
     *
     * @return array{0: Builder<Product>, 1: array{q: string, status: string, category: string, tag: string}}
     */
    private function filtered(Request $request, CategoryForest $forest): array
    {
        $search = trim($request->string('q')->toString());
        $status = $request->string('status')->toString();
        $status = in_array($status, self::STATUS_FILTERS, true) ? $status : '';
        $category = Category::query()->where('rid', $request->string('category')->toString())->first();
        $tag = Tag::query()->where('rid', $request->string('tag')->toString())->first();

        $query = Product::query()
            ->when($search !== '', function (Builder $query) use ($search): void {
                $like = '%'.$search.'%';
                $query->where(fn (Builder $inner) => $inner->where('name', 'like', $like)->orWhere('slug', 'like', $like));
            })
            ->when($category, fn (Builder $query) => $query->whereIn('category_id', $forest->subtreeIds($category->id)))
            ->when($tag, fn (Builder $query) => $query->whereHas('tags', fn (Builder $tags) => $tags->whereKey($tag->id)))
            ->when($status === 'active', fn (Builder $query) => $query->where('is_active', true))
            ->when($status === 'inactive', fn (Builder $query) => $query->where('is_active', false))
            ->when($status === 'featured', fn (Builder $query) => $query->where('is_featured', true))
            ->when($status === 'new_arrival', fn (Builder $query) => $query->where('is_new_arrival', true));

        return [$query, [
            'q' => $search,
            'status' => $status,
            'category' => $category?->rid ?? '',
            'tag' => $tag?->rid ?? '',
        ]];
    }

    public function create(Request $request): Response
    {
        abort_unless($request->user('staff')->can('create_products'), 403);

        $categoryRid = trim($request->string('category')->toString());

        return Inertia::render('Admin/Products/Create', [
            'categoryTree' => CategoryForest::load()->pickerNodes(),
            'allTags' => $this->allTagNames(),
            'shippingClasses' => $this->shippingClassOptions(),
            'defaultHandlingDays' => (int) config('shipping.default_handling_days'),
            'currencyCode' => Currency::defaultCode(),
            'attributeDefinitions' => $this->attributeDefinitions(),
            'defaultCategoryRid' => $categoryRid !== '' && Category::query()->where('rid', $categoryRid)->exists()
                ? $categoryRid
                : null,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user('staff')->can('create_products'), 403);

        $validated = $this->validated($request);
        $category = Category::query()->where('rid', $validated['category_rid'])->firstOrFail();

        $product = Product::query()->create([
            'name' => $validated['name'],
            'slug' => $validated['slug'],
            'category_id' => $category->id,
            'shipping_class_id' => $this->shippingClassId($validated['shipping_class_rid'] ?? null),
            'price_minor' => $this->toMinorUnits($validated['price']),
            'original_price_minor' => isset($validated['original_price'])
                ? $this->toMinorUnits($validated['original_price'])
                : null,
            'image' => $validated['image'] ?? null,
            'discount_notice' => $validated['discount_notice'] ?? null,
            'description_lines' => $this->cleanLines($validated['description_lines'] ?? null),
            'is_active' => $validated['is_active'],
            'is_featured' => $validated['is_featured'],
            'is_new_arrival' => $validated['is_new_arrival'],
            'currency_code' => Currency::defaultCode(),
            ...$this->familyAttributes($validated),
        ]);

        $product->syncTagsInOrder($this->tagIdsFor($validated['tags'] ?? null));
        $this->syncCatalogDetails($product, $validated);
        $this->syncGallery($product, $validated['gallery'] ?? []);

        if ($request->input('intent') === 'add_another') {
            return redirect()->route('admin.products.create', ['category' => $category->rid])
                ->with('success', "Product \"{$product->name}\" created. Add the next one.");
        }

        return redirect()->route('admin.products.index')
            ->with('success', "Product \"{$product->name}\" created.");
    }

    public function edit(Request $request, Product $product): Response
    {
        abort_unless($request->user('staff')->can('edit_products'), 403);

        $product->load('category:id,rid,label', 'tags', 'attributeValues.definition', 'variants', 'shippingClass', 'images');

        return Inertia::render('Admin/Products/Edit', [
            'product' => $this->serializeProduct($product),
            'categoryTree' => CategoryForest::load()->pickerNodes(),
            'allTags' => $this->allTagNames(),
            'shippingClasses' => $this->shippingClassOptions(),
            'defaultHandlingDays' => (int) config('shipping.default_handling_days'),
            'attributeDefinitions' => $this->attributeDefinitions(),
        ]);
    }

    public function update(Request $request, Product $product): RedirectResponse
    {
        abort_unless($request->user('staff')->can('edit_products'), 403);

        $validated = $this->validated($request, $product);
        $category = Category::query()->where('rid', $validated['category_rid'])->firstOrFail();

        $product->update([
            'name' => $validated['name'],
            'slug' => $validated['slug'],
            'category_id' => $category->id,
            'shipping_class_id' => $this->shippingClassId($validated['shipping_class_rid'] ?? null),
            'price_minor' => $this->toMinorUnits($validated['price']),
            'original_price_minor' => isset($validated['original_price'])
                ? $this->toMinorUnits($validated['original_price'])
                : null,
            'image' => $validated['image'] ?? null,
            'discount_notice' => $validated['discount_notice'] ?? null,
            'description_lines' => $this->cleanLines($validated['description_lines'] ?? null),
            'is_active' => $validated['is_active'],
            'is_featured' => $validated['is_featured'],
            'is_new_arrival' => $validated['is_new_arrival'],
            ...$this->familyAttributes($validated),
        ]);

        $product->syncTagsInOrder($this->tagIdsFor($validated['tags'] ?? null));
        $this->syncCatalogDetails($product, $validated);
        $this->syncGallery($product, $validated['gallery'] ?? []);

        return redirect()->route('admin.products.index')
            ->with('success', "Product \"{$product->name}\" saved.");
    }

    public function destroy(Request $request, Product $product): RedirectResponse
    {
        abort_unless($request->user('staff')->can('delete_products'), 403);

        $product->delete();

        return redirect()->route('admin.products.index')
            ->with('success', "Product \"{$product->name}\" deleted.");
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Product $product = null): array
    {
        $variantRids = $product?->variants()->pluck('rid')->all() ?? [];

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => [
                'required',
                'string',
                'max:255',
                Rule::unique('products', 'slug')->ignore($product?->id),
            ],
            'category_rid' => ['required', 'string', 'exists:categories,rid'],
            'tags' => ['nullable', 'array', 'max:10'],
            'tags.*' => ['string', 'max:60', 'distinct'],
            'shipping_class_rid' => ['nullable', 'string', 'exists:shipping_classes,rid'],
            'price' => ['required', 'numeric', 'min:0'],
            'original_price' => ['nullable', 'numeric', 'gt:price'],
            'image' => ['nullable', 'string', 'max:2048'],
            'gallery' => ['nullable', 'array', 'max:10'],
            'gallery.*' => ['array:path,variant_sku'],
            'gallery.*.path' => ['required', 'string', 'max:2048', 'distinct'],
            // A variant of this product, named by its SKU in this same form:
            // new variants have no rid yet, and a renamed SKU is the saved one.
            'gallery.*.variant_sku' => [
                'nullable',
                'string',
                Rule::in(collect($request->input('variants', []))
                    ->map(fn ($variant) => is_array($variant) ? ($variant['sku'] ?? null) : null)
                    ->filter(fn ($sku) => is_string($sku) && $sku !== '')
                    ->all()),
            ],
            'discount_notice' => ['nullable', 'string', 'max:255'],
            'description_lines' => ['nullable', 'array', 'max:50'],
            'description_lines.*' => ['required', 'string', 'max:2000'],
            'is_active' => ['required', 'boolean'],
            'is_featured' => ['required', 'boolean'],
            'is_new_arrival' => ['required', 'boolean'],
            'attributes' => ['nullable', 'array', 'max:30'],
            'attributes.*.attribute_rid' => ['required', 'string', 'distinct'],
            'attributes.*.value' => ['required', 'string', 'max:255'],
            'variants' => ['required', 'array', 'min:1', 'max:50'],
            'variants.*.rid' => ['nullable', 'string', Rule::in($variantRids)],
            'variants.*.name' => ['required', 'string', 'max:120', 'distinct'],
            'variants.*.size' => ['nullable', 'string', 'max:60'],
            'variants.*.color' => ['nullable', 'string', 'max:60'],
            'variants.*.sku' => ['required', 'string', 'max:64', 'distinct', 'regex:/^[A-Za-z0-9._-]+$/'],
            'variants.*.price' => ['nullable', 'numeric', 'min:0'],
            'variants.*.track_stock' => ['required', 'boolean'],
            'variants.*.stock_quantity' => ['nullable', 'required_if_accepted:variants.*.track_stock', 'integer', 'min:0'],
            'variants.*.is_default' => ['required', 'boolean'],
            'variants.*.handling_days' => ['nullable', 'integer', 'min:0', 'max:365'],
            // Product family: separate products shown as options of each other.
            'family_key' => ['nullable', 'string', 'max:120'],
            'family_option_name' => ['nullable', 'required_with:family_key', 'string', 'max:40'],
            'family_option_value' => ['nullable', 'required_with:family_key', 'string', 'max:60'],
        ], [
            'family_option_name.required_with' => 'Name the option shoppers choose, such as Size or Capacity.',
            'family_option_value.required_with' => 'Enter this product\'s option, such as 43 inch or 7 kg.',
            'slug.unique' => 'Another product already uses this slug. Change it so the storefront link is unique.',
            'category_rid.required' => 'Pick the category shoppers should find this product in.',
            'category_rid.exists' => 'That category no longer exists. Pick another one.',
            'tags.max' => 'Use at most 10 tags. Remove some to save.',
            'tags.*.max' => 'Keep each tag under 60 characters.',
            'tags.*.distinct' => 'Each tag can only be added once.',
            'shipping_class_rid.exists' => 'That shipping class no longer exists. Pick another, or Standard.',
            'original_price.gt' => 'The original price must be higher than the price, or leave it empty when the product is not on sale.',
            'gallery.*.path.required' => 'Add an image, or remove the row.',
            'gallery.*.path.distinct' => 'Each image can only be in the gallery once.',
            'gallery.*.variant_sku.in' => 'Pick one of this product\'s variants, or "No variant".',
            'attributes.*.attribute_rid.required' => 'Pick an attribute, or remove the row.',
            'attributes.*.attribute_rid.distinct' => 'Each attribute can only be set once.',
            'attributes.*.value.required' => 'Give the attribute a value, or remove the row.',
            'variants.required' => 'Add at least one variant. Shoppers buy variants, even if there is only one.',
            'variants.*.name.distinct' => 'Each variant needs a different name.',
            'variants.*.sku.required' => 'Every variant needs a SKU.',
            'variants.*.sku.distinct' => 'Each variant needs its own SKU.',
            'variants.*.sku.regex' => 'Use letters, numbers, dots, dashes or underscores in the SKU.',
            'variants.*.stock_quantity.required_if_accepted' => 'Enter how many are in stock, or turn off stock tracking.',
        ]);

        $this->assertAttributesFitCategory($validated);
        $validated = $this->normalizedFamily($validated, $product);

        $variants = $validated['variants'];
        if (count(array_filter($variants, fn (array $variant): bool => (bool) $variant['is_default'])) !== 1) {
            throw ValidationException::withMessages(['variants' => 'Mark exactly one variant as the default.']);
        }

        foreach ($variants as $index => $variant) {
            // SKU is the variant's natural key: reusing one of this product's
            // own SKUs is fine, another product's is not.
            $taken = ProductVariant::query()
                ->where('sku', strtoupper(trim($variant['sku'])))
                ->when($product, fn ($query) => $query->where('product_id', '!=', $product->id))
                ->exists();
            if ($taken) {
                throw ValidationException::withMessages(["variants.{$index}.sku" => 'Another product already uses this SKU.']);
            }
        }

        return $validated;
    }

    /**
     * Save facet attributes and variants. Variants left out of the form are
     * deleted (their cart lines go too; past orders keep their snapshot).
     *
     * @param  array<string, mixed>  $validated
     */
    private function syncCatalogDetails(Product $product, array $validated): void
    {
        DB::transaction(function () use ($product, $validated): void {
            $product->load('category');
            $keysByRid = $product->category->availableAttributes()->pluck('key', 'rid');

            $attributes = [];
            foreach ($validated['attributes'] ?? [] as $attribute) {
                $attributes[$keysByRid[$attribute['attribute_rid']]] = $attribute['value'];
            }

            $product->attributeValues()->whereNotIn('name', array_keys($attributes))->delete();
            $product->syncAttributes($attributes);

            $keep = [];
            foreach ($validated['variants'] as $data) {
                $values = [
                    'name' => trim($data['name']),
                    'size' => isset($data['size']) && trim((string) $data['size']) !== '' ? trim((string) $data['size']) : null,
                    'color' => isset($data['color']) && trim((string) $data['color']) !== '' ? trim((string) $data['color']) : null,
                    'sku' => strtoupper(trim($data['sku'])),
                    'price_minor' => isset($data['price']) && $data['price'] !== '' ? $this->toMinorUnits($data['price']) : null,
                    'stock_quantity' => $data['track_stock'] ? (int) $data['stock_quantity'] : null,
                    'handling_days' => isset($data['handling_days']) && $data['handling_days'] !== '' ? (int) $data['handling_days'] : null,
                    'is_default' => (bool) $data['is_default'],
                ];

                $variant = ! empty($data['rid'])
                    ? $product->variants()->where('rid', $data['rid'])->firstOrFail()
                    : $product->variants()->where('sku', $values['sku'])->first();

                if ($variant instanceof ProductVariant) {
                    $variant->update($values);
                } else {
                    $variant = $product->variants()->create($values);
                }

                $keep[] = $variant->id;
            }

            $product->variants()->whereNotIn('id', $keep)->delete();
        });
    }

    /**
     * Gallery images in form order, each optionally tagged with the variant it
     * shows. Runs after syncCatalogDetails, so a SKU renamed in the same save
     * resolves against the saved variants. The first gallery image doubles as
     * the cover when no separate cover image is set.
     *
     * @param  list<array{path: string, variant_sku?: string|null}>  $rows
     */
    private function syncGallery(Product $product, array $rows): void
    {
        $variantIds = $product->variants()->pluck('id', 'sku');

        $clean = [];
        foreach ($rows as $row) {
            $path = trim((string) $row['path']);
            if ($path === '' || array_key_exists($path, $clean)) {
                continue;
            }
            $sku = strtoupper(trim((string) ($row['variant_sku'] ?? '')));
            $clean[$path] = $sku === '' ? null : $variantIds[$sku];
        }
        $clean = array_slice($clean, 0, 10, true);

        DB::transaction(function () use ($product, $clean): void {
            $existing = $product->images()->orderBy('sort_order')->orderBy('id')->get();

            $position = 0;
            foreach ($clean as $path => $variantId) {
                $values = ['sort_order' => $position++, 'variant_id' => $variantId];
                $match = $existing->firstWhere('path', $path);
                if ($match) {
                    $match->update($values);

                    continue;
                }

                $product->images()->create(['path' => $path, ...$values]);
            }

            $product->images()->whereNotIn('path', array_keys($clean))->delete();
        });
    }

    /**
     * @return list<string>|null
     */
    private function cleanLines(mixed $lines): ?array
    {
        if (! is_array($lines)) {
            return null;
        }

        $clean = [];
        foreach ($lines as $line) {
            $line = trim((string) $line);
            if ($line !== '') {
                $clean[] = substr($line, 0, 2000);
            }
        }

        return array_slice($clean, 0, 50) ?: null;
    }

    private function toMinorUnits(mixed $major): int
    {
        return (int) round(((float) $major) * 100);
    }

    /**
     * @return list<string>
     */
    private function cleanTagNames(mixed $tags): array
    {
        if (! is_array($tags)) {
            return [];
        }

        $names = [];
        foreach ($tags as $tag) {
            $name = trim((string) $tag);
            if ($name === '' || in_array($name, $names, true)) {
                continue;
            }
            $names[] = $name;
        }

        return array_slice($names, 0, 10);
    }

    /**
     * @return list<int>
     */
    private function tagIdsFor(mixed $tags): array
    {
        $ids = [];
        foreach ($this->cleanTagNames($tags) as $name) {
            $ids[] = $this->findOrCreateTag($name)->id;
        }

        return $ids;
    }

    private function findOrCreateTag(string $name): Tag
    {
        $existing = Tag::query()->where('name', $name)->first();
        if ($existing instanceof Tag) {
            return $existing;
        }

        $slug = Str::slug($name) ?: 'tag';
        $candidate = $slug;
        $suffix = 2;
        while (Tag::query()->where('slug', $candidate)->exists()) {
            $candidate = $slug.'-'.$suffix;
            $suffix++;
        }

        return Tag::query()->create([
            'name' => $name,
            'slug' => $candidate,
        ]);
    }

    /**
     * @return list<string>
     */
    private function allTagNames(): array
    {
        return Tag::query()->orderBy('name')->pluck('name')->all();
    }

    private function shippingClassId(?string $rid): ?int
    {
        return $rid !== null && $rid !== '' ? ShippingClass::query()->where('rid', $rid)->value('id') : null;
    }

    /**
     * @return list<array{rid: string, name: string}>
     */
    private function shippingClassOptions(): array
    {
        return ShippingClass::query()->orderBy('name')->get(['rid', 'name'])->map->only(['rid', 'name'])->values()->all();
    }

    /**
     * Every category attribute with the values already in use (as typing
     * suggestions). The form picks the ones the chosen category offers.
     *
     * @return list<array<string, mixed>>
     */
    private function attributeDefinitions(): array
    {
        $used = ProductAttribute::query()
            ->whereNotNull('category_attribute_id')
            ->select(['category_attribute_id', 'value'])
            ->distinct()
            ->orderBy('value')
            ->get()
            ->groupBy('category_attribute_id');

        return CategoryAttribute::query()
            ->with('category:id,rid,label')
            ->orderBy('sort_order')
            ->orderBy('label')
            ->get()
            ->map(fn (CategoryAttribute $attribute) => [
                'rid' => $attribute->rid,
                'key' => $attribute->key,
                'label' => $attribute->label,
                'options' => $attribute->options ?? [],
                'categoryRid' => $attribute->category->rid,
                'categoryLabel' => $attribute->category->label,
                'usedValues' => ($used->get($attribute->id) ?? collect())->pluck('value')->take(50)->values()->all(),
            ])
            ->values()
            ->all();
    }

    /**
     * Each attribute must be one the product's category (or an ancestor)
     * offers, and respect its allowed values.
     *
     * @param  array<string, mixed>  $validated
     */
    private function assertAttributesFitCategory(array $validated): void
    {
        $rows = $validated['attributes'] ?? [];
        if ($rows === []) {
            return;
        }

        $category = Category::query()->where('rid', $validated['category_rid'])->firstOrFail();
        $available = $category->availableAttributes()->keyBy('rid');
        $errors = [];

        foreach (array_values($rows) as $index => $row) {
            $definition = $available->get($row['attribute_rid']);
            if ($definition === null) {
                $errors["attributes.{$index}.attribute_rid"] = "\"{$category->label}\" does not offer this attribute. Remove the row, or add the attribute to the category.";
            } elseif (! $definition->allows(trim($row['value']))) {
                $errors["attributes.{$index}.value"] = 'Pick one of: '.implode(', ', $definition->options).'.';
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    /**
     * @return array<string, mixed>
     */
    /**
     * Normalises the family fields and refuses a second product with the same
     * option in one family, which would put two identical choices side by side.
     *
     * The key is slugged ("TCL P635 TV" -> "tcl-p635-tv") so a typo in case or
     * spacing still links the products.
     *
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function normalizedFamily(array $validated, ?Product $product): array
    {
        $key = Str::slug((string) ($validated['family_key'] ?? ''));

        if ($key === '') {
            return [...$validated, 'family_key' => null, 'family_option_name' => null, 'family_option_value' => null];
        }

        $value = trim((string) $validated['family_option_value']);
        $clash = Product::query()
            ->where('family_key', $key)
            ->when($product, fn ($query) => $query->where('id', '!=', $product->id))
            ->whereRaw('LOWER(family_option_value) = ?', [Str::lower($value)])
            ->value('name');

        if ($clash !== null) {
            throw ValidationException::withMessages([
                'family_option_value' => "\"{$clash}\" already uses {$value} in this family. Give each product its own option.",
            ]);
        }

        return [
            ...$validated,
            'family_key' => $key,
            'family_option_name' => trim((string) $validated['family_option_name']),
            'family_option_value' => $value,
        ];
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array{family_key: ?string, family_option_name: ?string, family_option_value: ?string}
     */
    private function familyAttributes(array $validated): array
    {
        return [
            'family_key' => $validated['family_key'] ?? null,
            'family_option_name' => $validated['family_option_name'] ?? null,
            'family_option_value' => $validated['family_option_value'] ?? null,
        ];
    }

    private function serializeProduct(Product $product): array
    {
        return [
            'familyKey' => $product->family_key,
            'familyOptionName' => $product->family_option_name,
            'familyOptionValue' => $product->family_option_value,
            // The other products this one is linked to, so staff can see the
            // family they are editing.
            'familyMembers' => $product->family_key === null ? [] : Product::query()
                ->where('family_key', $product->family_key)
                ->where('id', '!=', $product->id)
                ->orderBy('family_option_value')
                ->get(['rid', 'name', 'family_option_value', 'is_active'])
                ->map(fn (Product $member) => [
                    'rid' => $member->rid,
                    'name' => $member->name,
                    'optionValue' => $member->family_option_value,
                    'isActive' => (bool) $member->is_active,
                ])->values()->all(),
            'rid' => $product->rid,
            'name' => $product->name,
            'slug' => $product->slug,
            'categoryRid' => $product->category?->rid,
            'tags' => $product->relationLoaded('tags')
                ? $product->tags->pluck('name')->values()->all()
                : [],
            'shippingClassRid' => $product->shippingClass?->rid,
            'shippingClassName' => $product->shippingClass?->name,
            'attributes' => $product->relationLoaded('attributeValues')
                ? $product->attributeValues
                    ->whereNotNull('category_attribute_id')
                    ->map(fn (ProductAttribute $attribute) => [
                        'attribute_rid' => $attribute->definition->rid,
                        'value' => $attribute->value,
                    ])
                    ->values()
                    ->all()
                : [],
            'variants' => $product->relationLoaded('variants')
                ? $product->variants->map(fn (ProductVariant $variant) => [
                    'rid' => $variant->rid,
                    'name' => $variant->name,
                    'size' => $variant->size,
                    'color' => $variant->color,
                    'sku' => $variant->sku,
                    'price' => $variant->price_minor !== null ? round($variant->price_minor / 100, 2) : null,
                    'trackStock' => $variant->tracksStock(),
                    'stockQuantity' => $variant->stock_quantity,
                    'handlingDays' => $variant->handling_days,
                    'isDefault' => $variant->is_default,
                ])->values()->all()
                : [],
            'currencyCode' => $product->currency_code,
            'price' => round($product->price_minor / 100, 2),
            'originalPrice' => $product->original_price_minor !== null
                ? round($product->original_price_minor / 100, 2)
                : null,
            'image' => $product->image,
            'imageUrl' => $product->image_url,
            'gallery' => $product->relationLoaded('images')
                ? $product->images->sortBy([['sort_order', 'asc'], ['id', 'asc']])->map(fn (ProductImage $image) => [
                    'path' => $image->path,
                    'variantSku' => $product->variants->firstWhere('id', $image->variant_id)?->sku,
                ])->values()->all()
                : [],
            'discountNotice' => $product->discount_notice,
            'descriptionLines' => $product->description_lines ?? [],
            'isActive' => $product->is_active,
            'isFeatured' => $product->is_featured,
            'isNewArrival' => $product->is_new_arrival,
            'handlingDays' => $product->relationLoaded('defaultVariant') ? $product->defaultVariant?->effectiveHandlingDays() : null,
        ];
    }
}
