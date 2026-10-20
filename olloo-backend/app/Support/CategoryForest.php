<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\Category;
use Illuminate\Support\Collection;

/**
 * Every category loaded in one query, with tree helpers that work in memory
 * so admin trees and breadcrumb paths render at any depth without N+1 queries.
 */
final class CategoryForest
{
    /** @var array<int, list<Category>> */
    private array $byParent = [];

    /** @var Collection<int, Category> */
    private Collection $byId;

    /**
     * @param  Collection<int, Category>  $categories
     */
    private function __construct(Collection $categories)
    {
        $this->byId = $categories->keyBy('id');
        foreach ($categories as $category) {
            $this->byParent[$category->parent_id ?? 0][] = $category;
        }
    }

    /**
     * @param  list<string>  $withCount
     */
    public static function load(array $withCount = []): self
    {
        return new self(
            Category::query()
                ->withCount($withCount)
                ->orderBy('sort_order')
                ->orderBy('label')
                ->get()
        );
    }

    /**
     * @template T of array
     *
     * @param  callable(Category, list<T>): T  $map  receives the node and its already-built children
     * @param  int|null  $excludeSubtreeOf  drop this category and everything under it
     * @return list<T>
     */
    public function build(callable $map, int $parentId = 0, ?int $excludeSubtreeOf = null): array
    {
        $nodes = [];
        foreach ($this->byParent[$parentId] ?? [] as $category) {
            if ($category->id === $excludeSubtreeOf) {
                continue;
            }
            $nodes[] = $map($category, $this->build($map, $category->id, $excludeSubtreeOf));
        }

        return $nodes;
    }

    /**
     * @return list<array{rid: string, label: string, children: list<mixed>}>
     */
    public function pickerNodes(?int $excludeSubtreeOf = null): array
    {
        return $this->build(
            fn (Category $category, array $children): array => [
                'rid' => $category->rid,
                'label' => $category->label,
                'children' => $children,
            ],
            0,
            $excludeSubtreeOf,
        );
    }

    public function pathLabel(Category $category): string
    {
        $parts = [$category->label];
        $parentId = $category->parent_id;
        $depth = 0;

        while ($parentId !== null && $depth < 10 && $this->byId->has($parentId)) {
            $parent = $this->byId->get($parentId);
            array_unshift($parts, $parent->label);
            $parentId = $parent->parent_id;
            $depth++;
        }

        return implode(' / ', $parts);
    }

    /**
     * @return list<int> the category itself plus every descendant
     */
    public function subtreeIds(int $id): array
    {
        $ids = [$id];
        foreach ($this->byParent[$id] ?? [] as $child) {
            array_push($ids, ...$this->subtreeIds($child->id));
        }

        return $ids;
    }
}
