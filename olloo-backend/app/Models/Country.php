<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Country extends Model
{
    use HasRid;

    protected $fillable = [
        'rid',
        'code',
        'alpha3',
        'name',
        'region',
        'phone_code',
        'currency_code',
        'flag',
        'synced_at',
    ];

    protected $hidden = [
        'id',
    ];

    protected function casts(): array
    {
        return [
            'synced_at' => 'datetime',
        ];
    }

    public function regions(): HasMany
    {
        return $this->hasMany(Region::class);
    }

    public function addresses(): HasMany
    {
        return $this->hasMany(Address::class);
    }

    /** Find a country by ISO code, rid, or exact name (case-insensitive). */
    public static function resolve(string $key): ?self
    {
        $key = trim($key);
        if ($key === '') {
            return null;
        }

        return static::query()
            ->where('code', strtoupper($key))
            ->orWhere('rid', $key)
            ->orWhereRaw('lower(name) = ?', [mb_strtolower($key)])
            ->first();
    }
}
