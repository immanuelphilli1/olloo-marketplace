<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Groups products that ship differently (for example "Bulky"). Products
 * without a class ship as standard; shipping rules can target one class.
 */
class ShippingClass extends Model
{
    use HasRid;

    protected $fillable = [
        'rid',
        'name',
    ];

    protected $hidden = [
        'id',
    ];

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function rules(): HasMany
    {
        return $this->hasMany(ShippingRule::class);
    }
}
