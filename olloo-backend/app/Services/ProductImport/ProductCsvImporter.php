<?php

declare(strict_types=1);

namespace App\Services\ProductImport;

use App\Models\Category;
use App\Models\Currency;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ShippingClass;
use App\Models\Tag;
use App\Support\CategoryForest;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

/**
 * Reads a staff CSV into a plan of product changes.
 *
 * The plan is deliberately separate from writing: the preview screen shows
 * exactly what each row will create or change, staff decide what happens to
 * rows that match an existing product, and only then does anything save.
 *
 * Money is never guessed. A row without a price, or with a price that is not a
 * number, is rejected rather than becoming 0.00.
 */
final class ProductCsvImporter
{
    /**
     * The header row, in the order staff see it. Keys are the CSV column
     * names, values are the human labels shown in the template and the UI.
     *
     * @var array<string, string>
     */
    public const COLUMNS = [
        'name' => 'Product name',
        'slug' => 'Store link (leave blank to use the name)',
        'category' => 'Category',
        'price' => 'Price',
        'original_price' => 'Price before sale (leave blank if not on sale)',
        'tags' => 'Tags (separate with ;)',
        'shipping_class' => 'Shipping group (leave blank for Standard)',
        'handling_days' => 'Extra days to prepare (leave blank for the default)',
        'visible' => 'Show in the shop (yes or no)',
        'featured' => 'Featured (yes or no)',
        'new_arrival' => 'New arrival (yes or no)',
        'description' => 'Description (separate lines with |)',
        'image' => 'Image file name or full web address',
        'sku' => 'SKU',
        'variant_name' => 'Option name (for example Large or Red)',
        'size' => 'Size',
        'color' => 'Colour',
        'variant_price' => 'Option price (leave blank to use the product price)',
        'stock_quantity' => 'How many in stock (leave blank if you do not count stock)',
        'variant_handling_days' => 'Extra days for this option',
    ];

    /**
     * Rows a single staff action may carry, so one paste cannot lock the
     * request for minutes. Matching the upload size limit is deliberate.
     */
    public const MAX_ROWS = 2000;

    /**
     * Parse CSV text into one planned product per group of rows.
     *
     * Rows are grouped by product: the first row of a product carries its
     * details and every following row that repeats the store link adds one
     * option (variant). That is how shop staff already think about "one
     * product with three sizes". A row that never repeats a store link starts
     * a product of its own, so two products in one file stay separate.
     *
     * @return list<array<string, mixed>>
     */
    public function plan(string $contents): array
    {
        $rows = $this->readRows($contents);

        if ($rows === []) {
            return [[
                'line' => 1,
                'name' => '',
                'slug' => '',
                'action' => 'invalid',
                'product' => null,
                'variants' => [],
                'errors' => ['The file is empty. Download the template and fill it in.'],
                'warnings' => [],
                'changes' => [],
            ]];
        }

        $groups = [];
        $previousKey = null;
        foreach ($rows as $row) {
            $key = $this->groupKey($row['cells'], $previousKey);
            $groups[$key] ??= ['line' => $row['line'], 'row' => $row['cells'], 'variants' => []];
            $groups[$key]['variants'][] = $row['cells'];
            $previousKey = $key;
        }

        $plans = [];
        foreach ($groups as $group) {
            $plans[] = $this->planGroup((int) $group['line'], $group['row'], $group['variants']);
        }

        return $plans;
    }

    /**
     * Build a blank template with one worked example row, so staff see the
     * shape without having to guess it.
     */
    public function template(): string
    {
        $example = [
            'name' => 'Cotton crew t-shirt',
            'slug' => 'cotton-crew-t-shirt',
            'category' => 'Apparel',
            'price' => '120.00',
            'original_price' => '150.00',
            'tags' => 'Summer;Bestseller',
            'shipping_class' => '',
            'handling_days' => '',
            'visible' => 'yes',
            'featured' => 'no',
            'new_arrival' => 'yes',
            'description' => 'Soft cotton, regular fit.|Machine washable',
            'image' => 'cotton-crew-t-shirt.jpg',
            'sku' => 'TEE-CREW-STD',
            'variant_name' => 'Standard',
            'size' => '',
            'color' => 'White',
            'variant_price' => '',
            'stock_quantity' => '25',
            'variant_handling_days' => '',
        ];

        return $this->toCsv(array_keys(self::COLUMNS), [$example]);
    }

    /**
     * @param  array<string, mixed>  $plan  One entry from plan().
     * @return array<string, mixed> The created or updated product.
     */
    public function apply(array $plan): Product
    {
        /** @var Product $product */
        $product = $this->write($plan);

        return $product;
    }

    /**
     * @param  array<string, mixed>  $plan
     */
    private function write(array $plan): Product
    {
        $values = $plan['values'];
        $variants = $plan['variants'];

        $category = Category::query()->findOrFail($values['category_id']);
        $shippingClassId = $values['shipping_class_id'];

        $product = $plan['product'] ?? new Product;
        $isNew = ! $product->exists;

        $product->fill([
            'name' => $values['name'],
            'slug' => $values['slug'],
            'category_id' => $values['category_id'],
            'shipping_class_id' => $shippingClassId,
            'price_minor' => $values['price_minor'],
            'original_price_minor' => $values['original_price_minor'],
            'discount_notice' => $values['discount_notice'],
            'description_lines' => $values['description_lines'],
            'is_active' => $values['is_active'],
            'is_featured' => $values['is_featured'],
            'is_new_arrival' => $values['is_new_arrival'],
        ]);

        if ($isNew) {
            $product->currency_code = $values['currency_code'];
        }

        if ($values['image'] !== null) {
            $product->image = $values['image'];
        }

        $product->save();

        // A blank tags column leaves existing tags alone; a given one replaces
        // them, which is what a corrected re-upload needs.
        if ($values['tags'] !== null) {
            $product->syncTagsInOrder($this->tagIds($values['tags']));
        }

        $this->writeVariants($product, $variants);

        return $product;
    }

    /**
     * Options are matched by SKU, which is the variant's natural key: an
     * option in this row either already exists on this product or is new.
     * Options the CSV omits are removed, matching what the product form does,
     * so a corrected CSV converges instead of accumulating stale options.
     *
     * @param  list<array<string, mixed>>  $variants
     */
    private function writeVariants(Product $product, array $variants): void
    {
        $keep = [];
        $madeDefault = false;

        foreach ($variants as $variant) {
            $existing = $product->variants()->where('sku', $variant['sku'])->first();

            $isDefault = ! $madeDefault && $variant['is_default'];
            $madeDefault = $madeDefault || $isDefault;

            $values = [
                'name' => $variant['name'],
                'size' => $variant['size'],
                'color' => $variant['color'],
                'sku' => $variant['sku'],
                'price_minor' => $variant['price_minor'],
                'stock_quantity' => $variant['stock_quantity'],
                'handling_days' => $variant['handling_days'],
                'is_default' => $isDefault,
            ];

            if ($existing instanceof ProductVariant) {
                $existing->update($values);
                $keep[] = $existing->id;
            } else {
                $keep[] = $product->variants()->create($values)->id;
            }
        }

        // A row group always has exactly one default: the first option unless a
        // later row claims it.
        $first = $product->variants()->whereIn('id', $keep)->orderBy('id')->first();
        if ($first instanceof ProductVariant && ! $first->is_default) {
            $first->update(['is_default' => true]);
        }

        $product->variants()->whereNotIn('id', $keep)->delete();
    }

    /**
     * @param  array<string, string>  $row
     * @param  list<array<string, string>>  $allRows
     * @return array<string, mixed>
     */
    private function planGroup(int $line, array $row, array $allRows): array
    {
        $errors = [];
        $warnings = [];

        $name = trim($row['name'] ?? '');
        $slugInput = strtolower(trim($row['slug'] ?? ''));
        $slug = $slugInput !== '' ? $slugInput : Str::slug($name);

        if ($name === '') {
            $errors[] = 'This row has no product name. Every row needs one.';
        }

        if ($slug === '') {
            $errors[] = 'This row has no usable store link. Give it a name with letters or numbers, or type the link yourself.';
        }

        $existing = $this->matchExisting($row, $slug);
        $action = $existing instanceof Product ? 'update' : 'create';

        $category = $this->resolveCategory($row['category'] ?? '', $errors);
        $price = $this->price($row['price'] ?? '', 'price', $existing, $errors);
        $originalPrice = $this->price($row['original_price'] ?? '', 'price before sale', $existing, $errors, allowBlank: true);

        if ($price !== null && $originalPrice !== null && $originalPrice <= $price) {
            $errors[] = 'The price before sale must be higher than the price, or leave it blank.';
            $originalPrice = null;
        }

        $currencyCode = $existing?->currency_code ?? $this->defaultCurrencyCode();

        if ($currencyCode === null) {
            $errors[] = 'No default currency is set, so prices cannot be stored. Set one in Currencies first.';
        }

        $sku = strtoupper(trim($row['sku'] ?? ''));
        $skusInFile = [];
        foreach ($allRows as $candidate) {
            $candidateSku = strtoupper(trim($candidate['sku'] ?? ''));
            if ($candidateSku !== '') {
                $skusInFile[] = $candidateSku;
            }
        }
        $duplicateInFile = $sku !== '' && count(array_keys($skusInFile, $sku, true)) > 1;
        if ($duplicateInFile) {
            $errors[] = "The SKU {$sku} appears more than once in this file. Each option needs its own SKU.";
        }

        if ($sku === '') {
            $sku = $this->skuFromSlug($slug, $existing);
            $warnings[] = "No SKU given, so this option will use {$sku}.";
        } elseif (! preg_match('/^[A-Za-z0-9._-]+$/', $sku)) {
            $errors[] = "The SKU {$sku} uses characters we do not allow. Use letters, numbers, dots, dashes or underscores.";
        } else {
            $this->assertSkuIsFree($sku, $existing, $errors);
        }

        $variants = [$this->planVariant($row, $sku, true, $line, $errors, $warnings)];

        $seenSkus = [$sku => true];
        foreach (array_slice($allRows, 1) as $offset => $extra) {
            $extraLine = $line + $offset + 1;
            $extraSku = strtoupper(trim($extra['sku'] ?? ''));

            if ($extraSku === '') {
                $extraSku = $this->skuFromSlug($slug, $existing).'-'.($offset + 1);
                $warnings[] = "Row {$extraLine}: no SKU given, so this option will use {$extraSku}.";
            } elseif (isset($seenSkus[$extraSku])) {
                $errors[] = "Row {$extraLine}: the SKU {$extraSku} is used more than once for this product. Each option needs its own SKU.";
            } elseif (! preg_match('/^[A-Za-z0-9._-]+$/', $extraSku)) {
                $errors[] = "Row {$extraLine}: the SKU {$extraSku} uses characters we do not allow. Use letters, numbers, dots, dashes or underscores.";
            } else {
                $this->assertSkuIsFree($extraSku, $existing, $errors, "Row {$extraLine}: ");
            }

            $seenSkus[$extraSku] = true;

            $variants[] = $this->planVariant($extra, $extraSku, false, $extraLine, $errors, $warnings);
        }

        $tags = trim($row['tags'] ?? '') === '' ? null : $this->tagNames($row['tags']);
        if ($tags !== null && $existing instanceof Product && $existing->tags()->count() > 0) {
            $warnings[] = 'Replaces the tags this product already has.';
        }

        $image = trim($row['image'] ?? '');
        if ($image !== '' && $existing instanceof Product && $existing->image !== null && $existing->image !== $image) {
            $warnings[] = 'Replaces the current main photo.';
        }

        $values = [
            'name' => $name,
            'slug' => $slug,
            'category_id' => $category?->id,
            'shipping_class_id' => $this->resolveShippingClassId($row['shipping_class'] ?? ''),
            'price_minor' => $price,
            'original_price_minor' => $originalPrice,
            'discount_notice' => $existing?->discount_notice,
            'description_lines' => $this->descriptionLines($row['description'] ?? '') ?? $existing?->description_lines,
            'is_active' => $this->yesNo($row['visible'] ?? '', $existing?->is_active ?? false),
            'is_featured' => $this->yesNo($row['featured'] ?? '', $existing?->is_featured ?? false),
            'is_new_arrival' => $this->yesNo($row['new_arrival'] ?? '', $existing?->is_new_arrival ?? false),
            'image' => $image !== '' ? $image : null,
            'currency_code' => $currencyCode,
            // null means "leave the tags as they are"; a list replaces them.
            'tags' => $tags,
        ];

        if ($slug !== '' && $this->slugTakenByAnother($slug, $existing)) {
            $errors[] = 'Another product already uses this store link. Make it unique.';
        }

        if ($errors !== []) {
            return [
                'line' => $line,
                'name' => $name !== '' ? $name : '(no name)',
                'slug' => $slug,
                'action' => 'invalid',
                'product' => null,
                'matched_by' => null,
                'variants' => [],
                'errors' => $errors,
                'warnings' => $warnings,
                'changes' => [],
                'values' => null,
            ];
        }

        return [
            'line' => $line,
            'name' => $name,
            'slug' => $slug,
            'action' => $action,
            'product' => $existing,
            'matched_by' => $this->matchedBy($row, $existing),
            'variants' => $variants,
            'errors' => [],
            'warnings' => $warnings,
            'changes' => $this->changes($values, $existing, $variants),
            'values' => $values,
        ];
    }

    /**
     * @param  array<string, string>  $row
     * @param  list<string>  $errors
     * @param  list<string>  $warnings
     * @return array<string, mixed>
     */
    private function planVariant(array $row, string $sku, bool $isDefaultRow, int $line, array &$errors, array &$warnings): array
    {
        $name = trim($row['variant_name'] ?? '');
        if ($name === '') {
            $name = $isDefaultRow ? 'Standard' : 'Option '.$sku;
        }

        $price = $this->price($row['variant_price'] ?? '', 'option price', null, $errors, allowBlank: true);

        $stock = trim($row['stock_quantity'] ?? '');
        $stockQuantity = null;
        if ($stock !== '') {
            if (! ctype_digit($stock)) {
                $errors[] = "Row {$line}: the stock for {$name} must be a whole number, or blank if you do not count stock.";
            } else {
                $stockQuantity = (int) $stock;
            }
        }

        $handling = trim($row['variant_handling_days'] ?? $row['handling_days'] ?? '');
        $handlingDays = null;
        if ($handling !== '') {
            if (! ctype_digit($handling)) {
                $errors[] = "Row {$line}: the extra days for {$name} must be a whole number, or blank.";
            } else {
                $handlingDays = (int) $handling;
            }
        }

        return [
            'sku' => $sku,
            'name' => $name,
            'size' => $this->text($row['size'] ?? ''),
            'color' => $this->text($row['color'] ?? ''),
            'price_minor' => $price,
            'stock_quantity' => $stockQuantity,
            'handling_days' => $handlingDays,
            'is_default' => $isDefaultRow,
        ];
    }

    /**
     * What the preview shows per row: which fields will change, and to what.
     * Money is compared in minor units because that is what is stored, but
     * shown in major units because that is what staff recognise.
     *
     * @param  array<string, mixed>  $values
     * @param  list<array<string, mixed>>  $variants
     * @return list<array{field: string, from: string|null, to: string|null}>
     */
    private function changes(array $values, ?Product $existing, array $variants): array
    {
        if (! $existing instanceof Product) {
            $changes = [
                ['field' => 'Product', 'from' => null, 'to' => $values['name']],
                ['field' => 'Store link', 'from' => null, 'to' => $values['slug']],
                ['field' => 'Category', 'from' => null, 'to' => $this->categoryLabel($values['category_id'])],
                ['field' => 'Price', 'from' => null, 'to' => $this->money($values['price_minor'], $values['currency_code'])],
                ['field' => 'Visible', 'from' => null, 'to' => $values['is_active'] ? 'Yes' : 'No'],
            ];

            foreach ($variants as $variant) {
                $changes[] = ['field' => 'Option', 'from' => null, 'to' => "{$variant['name']} ({$variant['sku']})"];
            }

            return $changes;
        }

        $changes = [];

        $compare = function (string $field, ?string $from, ?string $to) use (&$changes): void {
            if ($to !== null && $from !== $to) {
                $changes[] = ['field' => $field, 'from' => $from, 'to' => $to];
            }
        };

        $compare('Name', $existing->name, $values['name']);
        $compare('Store link', $existing->slug, $values['slug']);
        // Both sides as the full path: the bare label against the path reported
        // every re-imported product as moved.
        $compare('Category', $this->categoryLabel($existing->category_id), $this->categoryLabel($values['category_id']));
        $compare(
            'Price',
            $this->money($existing->price_minor, $existing->currency_code),
            $this->money($values['price_minor'], $values['currency_code']),
        );
        $compare(
            'Price before sale',
            $this->money($existing->original_price_minor, $existing->currency_code),
            $this->money($values['original_price_minor'], $values['currency_code']),
        );
        $compare('Visible', $existing->is_active ? 'Yes' : 'No', $values['is_active'] ? 'Yes' : 'No');
        $compare('Featured', $existing->is_featured ? 'Yes' : 'No', $values['is_featured'] ? 'Yes' : 'No');
        $compare('New arrival', $existing->is_new_arrival ? 'Yes' : 'No', $values['is_new_arrival'] ? 'Yes' : 'No');

        // Only report tags when the row actually said something: a blank tags
        // column leaves the existing tags alone rather than clearing them.
        if ($values['tags'] !== null) {
            $compare(
                'Tags',
                $existing->tags()->pluck('name')->join('; ') ?: null,
                implode('; ', $values['tags']),
            );
        }

        $compare('Main photo', $existing->image, $values['image']);

        // An option is listed only when it is new or something about it
        // differs, summarised the same way on both sides; listing every option
        // made an unchanged re-import look like it rewrote them all.
        foreach ($variants as $variant) {
            $known = $existing->variants()->where('sku', $variant['sku'])->first();
            $compare(
                'Option',
                $known instanceof ProductVariant ? $this->optionSummary($known->only(['name', 'sku', 'size', 'color', 'price_minor', 'stock_quantity', 'handling_days']), $existing->currency_code) : null,
                $this->optionSummary($variant, $values['currency_code']),
            );
        }

        return $changes;
    }

    /**
     * @param  array<string, mixed>  $option
     */
    private function optionSummary(array $option, ?string $currencyCode): string
    {
        return implode(', ', array_filter([
            "{$option['name']} ({$option['sku']})",
            $option['size'] !== null ? 'size '.$option['size'] : null,
            $option['color'] !== null ? 'colour '.$option['color'] : null,
            $option['price_minor'] !== null ? 'price '.$this->money($option['price_minor'], $currencyCode) : null,
            $option['stock_quantity'] !== null ? $option['stock_quantity'].' in stock' : 'stock not counted',
            $option['handling_days'] !== null ? '+'.$option['handling_days'].' days' : null,
        ]));
    }

    /**
     * @param  array<string, string>  $row
     */
    /**
     * The store link is checked first because it is the field the row set on
     * purpose, so it is the explanation staff recognise. The product reference
     * wins over it, since a reference is more specific than a link, and the SKU
     * is the last resort: it catches a renamed product whose option is
     * unchanged.
     *
     * @param  array<string, string>  $row
     */
    private function matchExisting(array $row, string $slug): ?Product
    {
        $rid = trim($row['slug'] ?? '');
        if ($rid !== '' && Product::query()->where('rid', $rid)->exists()) {
            return Product::query()->where('rid', $rid)->first();
        }

        if ($slug !== '') {
            $bySlug = Product::query()->where('slug', $slug)->first();
            if ($bySlug instanceof Product) {
                return $bySlug;
            }
        }

        $sku = strtoupper(trim($row['sku'] ?? ''));

        return $sku === ''
            ? null
            : Product::query()->whereHas('variants', fn (Builder $query) => $query->where('sku', $sku))->first();
    }

    /**
     * @param  array<string, string>  $row
     */
    private function matchedBy(array $row, ?Product $existing): ?string
    {
        if (! $existing instanceof Product) {
            return null;
        }

        if (trim($row['slug'] ?? '') === $existing->rid) {
            return 'product reference';
        }

        return $existing->slug === strtolower(trim($row['slug'] ?? '')) ? 'store link' : 'SKU';
    }

    /**
     * @param  list<string>  $errors
     */
    private function assertSkuIsFree(string $sku, ?Product $existing, array &$errors, string $prefix = ''): void
    {
        $taken = ProductVariant::query()
            ->where('sku', $sku)
            ->when($existing instanceof Product, fn (Builder $query) => $query->where('product_id', '!=', $existing->id))
            ->first();

        if ($taken instanceof ProductVariant) {
            $errors[] = $prefix."Another product already uses the SKU {$sku}. SKUs must be unique.";
        }
    }

    private function slugTakenByAnother(string $slug, ?Product $existing): bool
    {
        return Product::query()
            ->where('slug', $slug)
            ->when($existing instanceof Product, fn (Builder $query) => $query->where('id', '!=', $existing->id))
            ->exists();
    }

    /**
     * @param  list<string>  $errors
     */
    private function resolveCategory(string $value, array &$errors): ?Category
    {
        $value = trim($value);
        if ($value === '') {
            $errors[] = 'No category given. Every product needs a category.';

            return null;
        }

        $category = Category::query()
            ->where('rid', $value)
            ->orWhere('slug', Str::slug($value))
            ->first();

        if (! $category instanceof Category) {
            // Staff type the label they see in the shop, so match on it too.
            $category = Category::query()
                ->whereRaw('LOWER(label) = ?', [mb_strtolower($value)])
                ->first();
        }

        if (! $category instanceof Category) {
            $errors[] = "No category called \"{$value}\". Create it first, or use the exact name.";

            return null;
        }

        return $category;
    }

    private function categoryLabel(?int $categoryId): ?string
    {
        if ($categoryId === null) {
            return null;
        }

        $category = Category::query()->find($categoryId);

        return $category instanceof Category ? CategoryForest::load()->pathLabel($category) : null;
    }

    private function resolveShippingClassId(string $value): ?int
    {
        $value = trim($value);

        return $value === ''
            ? null
            : ShippingClass::query()->where('rid', $value)->orWhere('name', $value)->value('id');
    }

    /**
     * Money in, minor units out. A blank is only allowed where the column is
     * genuinely optional; a blank price on a new product is an error rather
     * than a free product.
     *
     * @param  list<string>  $errors
     */
    private function price(string $value, string $label, ?Product $existing, array &$errors, bool $allowBlank = false): ?int
    {
        $value = trim($value);

        if ($value === '') {
            if ($allowBlank || $existing instanceof Product) {
                return $existing instanceof Product ? $existing->{$this->priceColumnFor($label)} : null;
            }

            $errors[] = 'No price given. Every new product needs a price.';

            return null;
        }

        $clean = str_replace([',', ' '], '', $value);
        if (! is_numeric($clean) || (float) $clean < 0) {
            $errors[] = "The {$label} \"{$value}\" is not a number. Use digits, for example 120 or 120.00.";

            return null;
        }

        return (int) round(((float) $clean) * 100);
    }

    private function priceColumnFor(string $label): string
    {
        return $label === 'price before sale' ? 'original_price_minor' : 'price_minor';
    }

    /**
     * @return list<string>
     */
    private function tagNames(string $value): array
    {
        $names = [];
        foreach (preg_split('/[;,|]/', $value) ?: [] as $name) {
            $name = trim($name);
            if ($name !== '' && ! in_array($name, $names, true)) {
                $names[] = $name;
            }
        }

        return array_slice($names, 0, 10);
    }

    /**
     * @param  list<string>  $tags
     * @return list<int>
     */
    private function tagIds(array $tags): array
    {
        $ids = [];
        foreach ($tags as $name) {
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
            $candidate = $slug.'-'.$suffix++;
        }

        return Tag::query()->create(['name' => $name, 'slug' => $candidate]);
    }

    /**
     * @return list<string>|null
     */
    private function descriptionLines(string $value): ?array
    {
        $lines = [];
        foreach (explode('|', $value) as $line) {
            $line = trim($line);
            if ($line !== '') {
                $lines[] = $line;
            }
        }

        return $lines === [] ? null : $lines;
    }

    /**
     * A blank yes/no column keeps whatever the product already has, and for a
     * new product means "not visible". Staff see that default in the preview,
     * so nothing is hidden behind a guess.
     */
    private function yesNo(string $value, bool $fallback): bool
    {
        return match (strtolower(trim($value))) {
            'yes', 'y', 'true', '1' => true,
            'no', 'n', 'false', '0' => false,
            default => $fallback,
        };
    }

    private function skuFromSlug(string $slug, ?Product $existing): string
    {
        if ($existing instanceof Product) {
            $existingSku = $existing->variants()->where('name', 'Standard')->value('sku');
            if (is_string($existingSku) && $existingSku !== '') {
                return $existingSku;
            }
        }

        return strtoupper(Str::slug($slug)) ?: 'PRODUCT-'.strtoupper(substr(md5($slug), 0, 6));
    }

    private function text(string $value): ?string
    {
        $value = trim($value);

        return $value === '' ? null : $value;
    }

    private function money(?int $minor, ?string $currencyCode): ?string
    {
        if ($minor === null) {
            return null;
        }

        return number_format($minor / 100, 2).' '.($currencyCode ?? '');
    }

    /**
     * @return array<string, string>|null
     */
    private function defaultCurrencyCode(): ?string
    {
        $code = Currency::defaultCode();

        return $code === '' ? null : $code;
    }

    /**
     * Rows sharing a store link are one product: the first carries the details
     * and the rest add options. A row that has its own store link is always a
     * new product, and a row with neither name nor store link continues the
     * product above it, so a spreadsheet of extra sizes needs no filler.
     *
     * @param  array<string, string>  $row
     */
    private function groupKey(array $row, ?string $previousKey): string
    {
        $slug = strtolower(trim($row['slug'] ?? ''));

        if ($slug !== '') {
            return 'slug:'.$slug;
        }

        if (trim($row['name'] ?? '') === '' && $previousKey !== null) {
            return $previousKey;
        }

        return 'name:'.Str::slug(trim($row['name'] ?? ''));
    }

    /**
     * @return list<array{line: int, cells: array<string, string>}>
     */
    private function readRows(string $contents): array
    {
        $contents = preg_replace('/^\xEF\xBB\xBF/', '', $contents) ?? $contents;
        $handle = fopen('php://memory', 'r+');
        if ($handle === false) {
            return [];
        }
        fwrite($handle, $contents);
        rewind($handle);

        $header = fgetcsv($handle);
        if ($header === false) {
            fclose($handle);

            return [];
        }

        $header = array_map(
            static fn (string $column): string => strtolower(trim(preg_replace('/^\xEF\xBB\xBF/', '', $column) ?? $column)),
            $header,
        );

        $rows = [];
        $line = 1;
        while (($cells = fgetcsv($handle)) !== false) {
            $line++;
            if ($cells === [null] || $cells === []) {
                continue;
            }

            $assoc = [];
            foreach ($header as $index => $column) {
                if ($column === '') {
                    continue;
                }
                // An exported cell that would read as a formula carries a
                // leading apostrophe (CsvExport::cell); drop it again.
                $assoc[$column] = preg_replace('/^\'(?=[=+\-@])/', '', trim((string) ($cells[$index] ?? ''))) ?? '';
            }

            // A row with nothing in it is a blank line in the spreadsheet, not
            // a product missing every field.
            if (array_filter($assoc, static fn (string $value): bool => $value !== '') === []) {
                continue;
            }

            $rows[] = ['line' => $line, 'cells' => $assoc];
        }

        fclose($handle);

        if (count($rows) > self::MAX_ROWS) {
            return array_slice($rows, 0, self::MAX_ROWS);
        }

        return $rows;
    }

    /**
     * @param  list<string>  $header
     * @param  list<array<string, string>>  $rows
     */
    private function toCsv(array $header, array $rows): string
    {
        $handle = fopen('php://temp', 'r+');
        if ($handle === false) {
            return '';
        }

        // BOM so Excel opens UTF-8 product names correctly.
        fwrite($handle, "\xEF\xBB\xBF");
        fputcsv($handle, $header);
        foreach ($rows as $row) {
            fputcsv($handle, array_map(static fn (string $column): string => $row[$column] ?? '', $header));
        }

        rewind($handle);
        $contents = (string) stream_get_contents($handle);
        fclose($handle);

        return $contents;
    }

    /**
     * Rows that staff cannot act on, surfaced before the confirm step so a
     * broken file never half-imports.
     *
     * @param  list<array<string, mixed>>  $plans
     * @return list<array<string, mixed>>
     */
    public static function problems(array $plans): array
    {
        return array_values(array_filter(
            $plans,
            static fn (array $plan): bool => $plan['action'] === 'invalid',
        ));
    }

    /**
     * Rows that match something already in the catalog. Staff choose update or
     * skip for each of these on the preview screen.
     *
     * @param  list<array<string, mixed>>  $plans
     * @return list<array<string, mixed>>
     */
    public static function matched(array $plans): array
    {
        return array_values(array_filter(
            $plans,
            static fn (array $plan): bool => $plan['action'] === 'update',
        ));
    }
}
