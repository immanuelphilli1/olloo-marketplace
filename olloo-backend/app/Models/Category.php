<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasImageUrl;
use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Category extends Model
{
    use HasImageUrl;
    use HasRid;

    protected $fillable = [
        'rid',
        'slug',
        'label',
        'image',
        'parent_id',
        'sort_order',
        'is_active',
        'is_returnable',
        'return_window_days',
    ];

    protected $hidden = [
        'id',
    ];

    protected $appends = [
        'imageUrl',
    ];

    protected function casts(): array
    {
        return [
            'parent_id' => 'integer',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
            'is_returnable' => 'boolean',
            'return_window_days' => 'integer',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(Category::class, 'parent_id')->orderBy('sort_order')->orderBy('label');
    }

    /**
     * All descendant ids (any depth) for product filtering.
     *
     * @return list<int>
     */
    public function descendantIds(): array
    {
        $ids = [];
        $stack = $this->children()->pluck('id')->all();

        while ($stack !== []) {
            $id = array_pop($stack);
            $ids[] = $id;
            $childIds = static::query()->where('parent_id', $id)->pluck('id')->all();
            foreach ($childIds as $childId) {
                $stack[] = $childId;
            }
        }

        return $ids;
    }

    public function attributeDefinitions(): HasMany
    {
        return $this->hasMany(CategoryAttribute::class)->orderBy('sort_order')->orderBy('label');
    }

    /**
     * Parent, grandparent, ... up to the root (nearest first).
     *
     * @return list<int>
     */
    public function ancestorIds(): array
    {
        $ids = [];
        $parentId = $this->parent_id;
        while ($parentId !== null && count($ids) < 20) {
            $ids[] = (int) $parentId;
            $parentId = static::query()->whereKey($parentId)->value('parent_id');
        }

        return $ids;
    }

    /**
     * Attributes products in this category may use: its own plus every
     * ancestor's, root first.
     *
     * @return Collection<int, CategoryAttribute>
     */
    public function availableAttributes(): Collection
    {
        $lineage = [...array_reverse($this->ancestorIds()), $this->id];

        return CategoryAttribute::query()
            ->whereIn('category_id', $lineage)
            ->get()
            ->sortBy(fn (CategoryAttribute $attribute) => [array_search($attribute->category_id, $lineage, true), $attribute->sort_order, $attribute->label])
            ->values();
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    /**
     * Resolve route bindings by rid first, then slug (categoryId path compatibility).
     */
    public function resolveRouteBinding($value, $field = null): ?Model
    {
        if ($field !== null) {
            return parent::resolveRouteBinding($value, $field);
        }

        $byRid = static::query()->where('rid', $value)->first();
        if ($byRid !== null) {
            return $byRid;
        }

        return static::query()->where('slug', $value)->first();
    }
}
