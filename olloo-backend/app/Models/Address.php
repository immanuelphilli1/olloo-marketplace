<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Address extends Model
{
    use HasRid;

    protected $fillable = [
        'rid',
        'user_id',
        'country_id',
        'region_id',
        'city_id',
        'first_name',
        'last_name',
        'phone_country_code',
        'phone_number',
        'address_line',
        'region',
        'city',
        'city_line',
        'is_default',
    ];

    protected $hidden = [
        'id',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    public function regionRecord(): BelongsTo
    {
        return $this->belongsTo(Region::class, 'region_id');
    }

    public function cityRecord(): BelongsTo
    {
        return $this->belongsTo(City::class, 'city_id');
    }
}
