<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\CategoryAttribute;
use App\Models\Product;
use App\Support\CategoryForest;
use App\Support\CsvExport;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CategoryController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('view_categories'), 403);

        return Inertia::render('Admin/Categories/Index', [
            'tree' => $this->adminTree(CategoryForest::load(['children', 'products'])),
            ...$this->abilities($request),
        ]);
    }

    /**
     * Every category as CSV, in tree order: each category followed by its
     * subcategories, so the file reads like the tree on screen.
     */
    public function export(Request $request): StreamedResponse
    {
        abort_unless($request->user('staff')?->can('view_categories'), 403);

        $forest = CategoryForest::load(['products']);
        $slugs = Category::query()->pluck('slug', 'id');

        $rows = array_merge([], ...$forest->build(
            fn (Category $category, array $children): array => [
                [
                    'slug' => $category->slug,
                    'label' => $category->label,
                    'parent' => $category->parent_id === null ? '' : (string) $slugs->get($category->parent_id),
                    'path' => $forest->pathLabel($category),
                    'visible' => $category->is_active ? 'yes' : 'no',
                    'sort_order' => (string) $category->sort_order,
                    'returnable' => $category->is_returnable ? 'yes' : 'no',
                    // Blank: the window comes from the parent category or the store default.
                    'return_window_days' => $category->return_window_days === null ? '' : (string) $category->return_window_days,
                    'image' => (string) $category->image,
                    // Products filed directly here, not in subcategories.
                    'products' => (string) $category->products_count,
                ],
                ...array_merge([], ...$children),
            ],
        ));

        return CsvExport::download(
            'categories-'.now()->format('Y-m-d').'.csv',
            ['slug', 'label', 'parent', 'path', 'visible', 'sort_order', 'returnable', 'return_window_days', 'image', 'products'],
            $rows,
        );
    }

    public function create(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('create_categories'), 403);

        $defaultParentRid = null;
        $parentRid = trim((string) $request->query('parent', ''));
        if ($parentRid !== '' && Category::query()->where('rid', $parentRid)->exists()) {
            $defaultParentRid = $parentRid;
        }

        return Inertia::render('Admin/Categories/Create', [
            'parentTree' => CategoryForest::load()->pickerNodes(),
            'defaultParentRid' => $defaultParentRid,
            'definitions' => $this->allDefinitions(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('create_categories'), 403);

        $validated = $this->validated($request);

        $parentId = $this->resolveParentId($validated['parent_rid'] ?? null);
        $attributes = $this->validatedAttributes($request, null, $parentId);

        $category = DB::transaction(function () use ($validated, $parentId, $attributes): Category {
            $category = Category::query()->create([
                'label' => $validated['label'],
                'slug' => $validated['slug'],
                'image' => $validated['image'] ?? null,
                'parent_id' => $parentId,
                'sort_order' => $validated['sort_order'],
                'is_active' => $validated['is_active'],
                'is_returnable' => $validated['is_returnable'] ?? true,
                'return_window_days' => $validated['return_window_days'] ?? null,
            ]);
            $this->syncAttributes($category, $attributes);

            return $category;
        });

        // Land where the new category is visible in its tree: the parent's
        // page for a child, or its own page so children can be added next.
        $category->load('parent:id,rid');

        return redirect()
            ->route('admin.categories.show', $category->parent?->rid ?? $category->rid)
            ->with('success', "Category \"{$category->label}\" created.");
    }

    public function show(Request $request, Category $category): Response
    {
        abort_unless($request->user('staff')?->can('view_categories'), 403);

        $forest = CategoryForest::load(['children', 'products']);

        return Inertia::render('Admin/Categories/Show', [
            'category' => [
                'rid' => $category->rid,
                'label' => $category->label,
                'slug' => $category->slug,
                'imageUrl' => $category->image_url,
                'path' => $forest->pathLabel($category),
                'parentRid' => $category->parent?->rid,
                'isActive' => $category->is_active,
                'isReturnable' => $category->is_returnable,
                'returnWindowDays' => $category->return_window_days,
                'productsCount' => $category->products()->count(),
                'subtreeProductsCount' => Product::query()->whereIn('category_id', $forest->subtreeIds($category->id))->count(),
                'children' => $this->adminTree($forest, $category->id),
                'attributes' => $category->availableAttributes()
                    ->load('category:id,rid,label')
                    ->map(fn (CategoryAttribute $attribute) => [
                        'rid' => $attribute->rid,
                        'label' => $attribute->label,
                        'key' => $attribute->key,
                        'options' => $attribute->options ?? [],
                        'inheritedFrom' => $attribute->category_id === $category->id ? null : [
                            'rid' => $attribute->category->rid,
                            'label' => $attribute->category->label,
                        ],
                    ])
                    ->values()
                    ->all(),
            ],
            ...$this->abilities($request),
            'canCreateProducts' => (bool) $request->user('staff')?->can('create_products'),
            'canViewProducts' => (bool) $request->user('staff')?->can('view_products'),
        ]);
    }

    public function edit(Request $request, Category $category): Response
    {
        abort_unless($request->user('staff')?->can('edit_categories'), 403);

        $category->load('parent:id,rid');

        return Inertia::render('Admin/Categories/Edit', [
            'category' => [
                'rid' => $category->rid,
                'label' => $category->label,
                'slug' => $category->slug,
                'image' => $category->image,
                'parentRid' => $category->parent?->rid,
                'sortOrder' => $category->sort_order,
                'isActive' => $category->is_active,
                'isReturnable' => $category->is_returnable,
                'returnWindowDays' => $category->return_window_days,
                'childrenCount' => $category->children()->count(),
                'productsCount' => $category->products()->count(),
                'attributes' => $category->attributeDefinitions()
                    ->withCount('values')
                    ->get()
                    ->map(fn (CategoryAttribute $attribute) => [
                        'rid' => $attribute->rid,
                        'key' => $attribute->key,
                        'label' => $attribute->label,
                        'options' => $attribute->options ?? [],
                        'productsCount' => $attribute->values_count,
                    ])
                    ->values()
                    ->all(),
            ],
            'definitions' => $this->allDefinitions(),
            // A category cannot move under itself or its own descendants.
            'parentTree' => CategoryForest::load()->pickerNodes($category->id),
            'canDelete' => (bool) $request->user('staff')?->can('delete_categories'),
        ]);
    }

    public function update(Request $request, Category $category): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('edit_categories'), 403);

        $validated = $this->validated($request, $category);

        $parentId = $this->resolveParentId($validated['parent_rid'] ?? null);

        if ($parentId !== null && ($parentId === $category->id || in_array($parentId, $category->descendantIds(), true))) {
            throw ValidationException::withMessages([
                'parent_rid' => 'A category cannot move under itself or one of its own children. Pick a different parent.',
            ]);
        }

        $attributes = $this->validatedAttributes($request, $category, $parentId);

        DB::transaction(function () use ($category, $validated, $parentId, $attributes): void {
            $category->update([
                'label' => $validated['label'],
                'slug' => $validated['slug'],
                'image' => $validated['image'] ?? null,
                'parent_id' => $parentId,
                'sort_order' => $validated['sort_order'],
                'is_active' => $validated['is_active'],
                'is_returnable' => $validated['is_returnable'] ?? $category->is_returnable,
                'return_window_days' => $validated['return_window_days'] ?? null,
            ]);
            $this->syncAttributes($category, $attributes);
        });

        return redirect()->route('admin.categories.show', $category->rid)
            ->with('success', "Category \"{$category->label}\" saved.");
    }

    public function destroy(Request $request, Category $category): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('delete_categories'), 403);

        if ($category->children()->exists()) {
            return back()->with('error', 'Cannot delete a category that still has child categories. Move or delete them first.');
        }

        if ($category->products()->exists()) {
            return back()->with('error', 'Cannot delete a category that still has products. Move its products to another category first.');
        }

        $category->delete();
        $deleted = "Category \"{$category->label}\" deleted.";

        // Stay in tree context when the delete came from a details page
        // whose root still exists; otherwise fall back to the index.
        $fromRid = trim((string) $request->query('from', ''));
        if ($fromRid !== '' && $fromRid !== $category->rid
            && Category::query()->where('rid', $fromRid)->exists()
        ) {
            return redirect()->route('admin.categories.show', $fromRid)->with('success', $deleted);
        }

        return redirect()->route('admin.categories.index')->with('success', $deleted);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Category $category = null): array
    {
        return $request->validate([
            'label' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', Rule::unique('categories', 'slug')->ignore($category?->id)],
            'image' => ['nullable', 'string', 'max:2048'],
            'parent_rid' => ['nullable', 'string', 'exists:categories,rid'],
            'sort_order' => ['required', 'integer', 'min:0'],
            'is_active' => ['required', 'boolean'],
            'is_returnable' => ['sometimes', 'boolean'],
            'return_window_days' => ['nullable', 'integer', 'min:1', 'max:365'],
        ], [
            'slug.unique' => 'Another category already uses this slug. Change it so the storefront link is unique.',
            'parent_rid.exists' => 'That parent category no longer exists. Pick another one or make this a top-level category.',
        ]);
    }

    /**
     * Validate the attribute definitions this category offers. Keys must be
     * unique across the category's lineage (ancestors and subcategories), and
     * a list of allowed values must still cover values products already use.
     *
     * @return list<array{rid: string|null, key: string, label: string, options: list<string>|null}>
     */
    private function validatedAttributes(Request $request, ?Category $category, ?int $parentId): array
    {
        $ownRids = $category?->attributeDefinitions()->pluck('rid')->all() ?? [];

        $rows = $request->validate([
            'attributes' => ['nullable', 'array', 'max:30'],
            'attributes.*.rid' => ['nullable', 'string', Rule::in($ownRids)],
            'attributes.*.label' => ['required', 'string', 'max:120', 'distinct:ignore_case'],
            'attributes.*.options' => ['nullable', 'array', 'max:100'],
            'attributes.*.options.*' => ['required', 'string', 'max:120', 'distinct'],
        ], [
            'attributes.*.label.required' => 'Give the attribute a display name, or remove the row.',
            'attributes.*.label.distinct' => 'Each attribute needs a different display name.',
            'attributes.*.options.*.distinct' => 'List each allowed value once.',
        ])['attributes'] ?? [];

        $existing = $category?->attributeDefinitions()->get()->keyBy('rid') ?? collect();
        $parent = $parentId !== null ? Category::query()->find($parentId) : null;
        $inherited = $parent?->availableAttributes()->keyBy('key') ?? collect();
        $belowIds = $category?->descendantIds() ?? [];
        $below = $belowIds === [] ? collect() : CategoryAttribute::query()->with('category:id,label')->whereIn('category_id', $belowIds)->get()->keyBy('key');

        $errors = [];
        $keys = [];
        $clean = [];

        foreach (array_values($rows) as $index => $row) {
            $label = trim($row['label']);
            $current = ! empty($row['rid']) ? $existing->get($row['rid']) : null;
            // Keys never change once created: storefront filters use them.
            $key = $current?->key ?? CategoryAttribute::keyFromLabel($label);
            $options = array_values(array_filter(array_map('trim', $row['options'] ?? []), fn (string $value) => $value !== ''));

            if (! preg_match('/^[a-z][A-Za-z0-9]*$/', $key)) {
                $errors["attributes.{$index}.label"] = 'Start the display name with a letter, for example "Screen size".';
            } elseif (in_array($key, CategoryAttribute::RESERVED_KEYS, true)) {
                $errors["attributes.{$index}.label"] = 'Delivery is worked out from shipping rules, so it cannot be an attribute.';
            } elseif (isset($keys[$key])) {
                $errors["attributes.{$index}.label"] = 'Another attribute here already uses this display name.';
            } elseif ($inherited->has($key)) {
                $errors["attributes.{$index}.label"] = 'Already inherited from "'.$inherited[$key]->category->label.'". Products here can use it as is.';
            } elseif ($below->has($key)) {
                $errors["attributes.{$index}.label"] = 'Subcategory "'.$below[$key]->category->label.'" defines this already. Remove it there first.';
            }

            if ($current !== null && $options !== []) {
                $outside = $current->values()->whereNotIn('value', $options)->distinct()->pluck('value')->all();
                if ($outside !== []) {
                    $errors["attributes.{$index}.options"] = 'Products already use '.implode(', ', array_map(fn ($value) => "\"{$value}\"", array_slice($outside, 0, 5))).'. Add those values or change those products first.';
                }
            }

            $keys[$key] = true;
            $clean[] = ['rid' => $current?->rid, 'key' => $key, 'label' => $label, 'options' => $options === [] ? null : $options];
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return $clean;
    }

    /**
     * Save definitions in form order. Removed definitions take their product
     * values with them (the form confirms this first).
     *
     * @param  list<array{rid: string|null, key: string, label: string, options: list<string>|null}>  $attributes
     */
    private function syncAttributes(Category $category, array $attributes): void
    {
        $keep = [];
        foreach ($attributes as $position => $attribute) {
            $values = ['label' => $attribute['label'], 'options' => $attribute['options'], 'sort_order' => $position];

            $definition = $attribute['rid'] !== null
                ? tap($category->attributeDefinitions()->where('rid', $attribute['rid'])->firstOrFail())->update($values)
                : $category->attributeDefinitions()->create(['key' => $attribute['key'], ...$values]);

            $keep[] = $definition->id;
        }

        $category->attributeDefinitions()->whereNotIn('id', $keep)->delete();
    }

    /**
     * Every definition with its category, so forms can work out what a
     * category inherits as the parent picker changes.
     *
     * @return list<array<string, mixed>>
     */
    private function allDefinitions(): array
    {
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
            ])
            ->values()
            ->all();
    }

    private function resolveParentId(?string $parentRid): ?int
    {
        if ($parentRid === null || $parentRid === '') {
            return null;
        }

        return Category::query()->where('rid', $parentRid)->value('id');
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function adminTree(CategoryForest $forest, int $parentId = 0): array
    {
        return $forest->build(fn (Category $node, array $children): array => [
            'rid' => $node->rid,
            'label' => $node->label,
            'slug' => $node->slug,
            'imageUrl' => $node->image_url,
            'isActive' => $node->is_active,
            'childrenCount' => $node->children_count,
            'productsCount' => $node->products_count,
            'children' => $children,
        ], $parentId);
    }

    /**
     * @return array{canCreate: bool, canEdit: bool, canDelete: bool}
     */
    private function abilities(Request $request): array
    {
        $staff = $request->user('staff');

        return [
            'canCreate' => (bool) $staff?->can('create_categories'),
            'canEdit' => (bool) $staff?->can('edit_categories'),
            'canDelete' => (bool) $staff?->can('delete_categories'),
        ];
    }
}
