<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class City extends Model
{
    use HasRid;

    protected $fillable = [
        'rid',
        'region_id',
        'name',
    ];

    protected $hidden = [
        'id',
    ];

    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }
}
