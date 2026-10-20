<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Products taxed differently from the standard rate (for example zero-rated). */
class TaxClass extends Model
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

    public function rates(): HasMany
    {
        return $this->hasMany(TaxRate::class);
    }
}
