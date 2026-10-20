<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Tag;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Tags are product attributes, so they reuse the product permissions. The
 * storefront badge is simply each product's first tag in display order.
 */
class TagController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('view_products'), 403);

        $staff = $request->user('staff');
        $search = trim((string) $request->query('q', ''));

        $query = Tag::query()->withCount('products')->orderBy('name');

        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(fn ($inner) => $inner->where('name', 'like', $like)->orWhere('slug', 'like', $like));
        }

        // The unused count describes the whole catalog, not the page, so it is
        // a separate count rather than something read off the rows on screen.
        $unused = Tag::query()->has('products', '=', 0)->count();

        return Inertia::render('Admin/Tags/Index', [
            'tags' => $query
                ->paginate((int) config('admin.per_page'))
                ->withQueryString()
                ->through(fn (Tag $tag) => [
                    'rid' => $tag->rid,
                    'name' => $tag->name,
                    'slug' => $tag->slug,
                    'productsCount' => $tag->products_count,
                ]),
            'filters' => ['q' => $search],
            'total' => Tag::query()->count(),
            'unused' => $unused,
            // Merging needs to name any other tag, so the picker keeps a plain
            // name list rather than being limited to the current page.
            'mergeTargets' => Tag::query()
                ->orderBy('name')
                ->get(['rid', 'name'])
                ->map->only(['rid', 'name'])
                ->values()
                ->all(),
            'canEdit' => (bool) $staff?->can('edit_products'),
            'canDelete' => (bool) $staff?->can('delete_products'),
        ]);
    }

    public function update(Request $request, Tag $tag): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('edit_products'), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:60', Rule::unique('tags', 'name')->ignore($tag->id)],
        ], [
            'name.unique' => 'Another tag already has this name. Use "Merge" to combine the two instead.',
        ]);

        $name = trim($validated['name']);
        $previous = $tag->name;

        $tag->update(['name' => $name]);

        return back()->with('success', "Tag \"{$previous}\" renamed to \"{$name}\".");
    }

    public function merge(Request $request, Tag $tag): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('edit_products'), 403);

        $validated = $request->validate([
            'target_rid' => ['required', 'string', 'exists:tags,rid', Rule::notIn([$tag->rid])],
        ], [
            'target_rid.required' => 'Pick the tag to merge into.',
            'target_rid.not_in' => 'Pick a different tag to merge into.',
        ]);

        $target = Tag::query()->where('rid', $validated['target_rid'])->firstOrFail();

        DB::transaction(function () use ($tag, $target): void {
            // Products that only had the source tag get the target in its place.
            $alreadyTagged = $target->products()->pluck('products.id')->all();
            foreach ($tag->products()->get() as $product) {
                if (! in_array($product->id, $alreadyTagged, true)) {
                    $target->products()->attach($product->id, ['position' => $product->pivot->position]);
                }
            }
            $tag->products()->detach();
            $tag->delete();
        });

        return back()->with('success', "Merged \"{$tag->name}\" into \"{$target->name}\".");
    }

    public function destroy(Request $request, Tag $tag): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('delete_products'), 403);

        DB::transaction(function () use ($tag): void {
            $tag->products()->detach();
            $tag->delete();
        });

        return back()->with('success', "Tag \"{$tag->name}\" deleted.");
    }
}
