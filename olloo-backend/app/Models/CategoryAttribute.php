<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * An attribute a category offers its products (and its subcategories'
 * products). `key` is the stable filter name on the wire; `label` is what
 * staff and shoppers read; `options` restricts values when set.
 */
class CategoryAttribute extends Model
{
    use HasRid;

    /** Keys the product API already uses for computed fields. */
    public const RESERVED_KEYS = ['delivery'];

    protected $fillable = [
        'rid',
        'category_id',
        'key',
        'label',
        'options',
        'sort_order',
    ];

    protected $hidden = [
        'id',
        'category_id',
    ];

    protected function casts(): array
    {
        return [
            'options' => 'array',
            'sort_order' => 'integer',
        ];
    }

    /** "Screen size" becomes "screenSize". */
    public static function keyFromLabel(string $label): string
    {
        return Str::camel(Str::slug($label, ' '));
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function values(): HasMany
    {
        return $this->hasMany(ProductAttribute::class);
    }

    public function allows(string $value): bool
    {
        return $this->options === null || $this->options === [] || in_array($value, $this->options, true);
    }
}
