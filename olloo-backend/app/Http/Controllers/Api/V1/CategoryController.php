<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class CategoryController extends Controller
{
    private const MAX_DEPTH = 10;

    public function index(Request $request): JsonResponse
    {
        $depth = $this->requestedDepth($request);

        $categories = Category::query()
            ->where('is_active', true)
            ->whereNull('parent_id')
            ->orderBy('sort_order')
            ->with($this->childrenEagerLoad($depth))
            ->get();

        return response()->json([
            'categories' => $categories->map(fn (Category $category) => $this->serializeNode($category, $depth))->values()->all(),
        ]);
    }

    public function show(Request $request, Category $category): JsonResponse
    {
        if (! $category->is_active) {
            abort(404);
        }

        $depth = $this->requestedDepth($request);
        $category->load($this->childrenEagerLoad($depth));

        return response()->json($this->serializeNode($category, $depth));
    }

    public function panel(Request $request, Category $category): JsonResponse
    {
        if (! $category->is_active) {
            abort(404);
        }

        $depth = $this->requestedDepth($request);
        $category->load($this->childrenEagerLoad($depth), 'parent');

        $children = ($depth !== null && $depth <= 0)
            ? []
            : $category->children->map(fn (Category $child) => $this->serializeNode($child, $this->childDepth($depth)))->values()->all();

        return response()->json([
            'slug' => $category->slug,
            'rid' => $category->rid,
            'label' => $category->label,
            'image' => $category->image,
            'imageUrl' => $category->image_url,
            'parent' => $category->parent ? [
                'rid' => $category->parent->rid,
                'slug' => $category->parent->slug,
                'label' => $category->parent->label,
            ] : null,
            'children' => $children,
            'sections' => [
                [
                    'title' => $category->label,
                    'children' => $children,
                ],
            ],
        ]);
    }

    /**
     * Null means unlimited. 0 means no children, N means N levels.
     */
    private function requestedDepth(Request $request): ?int
    {
        $validated = $request->validate([
            'depth' => ['nullable', 'integer', 'min:0', 'max:'.self::MAX_DEPTH],
        ]);

        return isset($validated['depth']) ? (int) $validated['depth'] : null;
    }

    /**
     * @return string|array<int, string>
     */
    private function childrenEagerLoad(?int $depth): string|array
    {
        if ($depth === null) {
            return 'children.children.children';
        }

        if ($depth <= 0) {
            return [];
        }

        return implode('.', array_fill(0, min($depth, self::MAX_DEPTH), 'children'));
    }

    private function childDepth(?int $depth): ?int
    {
        return $depth === null ? null : max(0, $depth - 1);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeNode(Category $category, ?int $depth): array
    {
        $children = ($depth !== null && $depth <= 0)
            ? []
            : $category->children->map(fn (Category $child) => $this->serializeNode($child, $this->childDepth($depth)))->values()->all();

        return [
            'slug' => $category->slug,
            'rid' => $category->rid,
            'label' => $category->label,
            'image' => $category->image,
            'imageUrl' => $category->image_url,
            'children' => $children,
        ];
    }
}
