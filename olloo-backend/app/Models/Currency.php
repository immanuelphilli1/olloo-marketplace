<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use RuntimeException;

class Currency extends Model
{
    use HasRid;

    protected $fillable = [
        'rid',
        'code',
        'name',
        'country_code',
        'payment_provider',
        'decimal_places',
        'is_default',
    ];

    protected $hidden = [
        'id',
    ];

    protected function casts(): array
    {
        return [
            'decimal_places' => 'integer',
            'is_default' => 'boolean',
        ];
    }

    public function country(): ?BelongsTo
    {
        return $this->belongsTo(Country::class, 'country_code', 'code');
    }

    /**
     * The store's base currency (the row flagged is_default). Missing config is
     * a deployment error, so this throws instead of guessing a currency.
     */
    public static function defaultCode(): string
    {
        $code = static::query()->where('is_default', true)->value('code');

        if (! is_string($code) || $code === '') {
            throw new RuntimeException('No default currency configured. Mark one row in `currencies` as is_default (php artisan db:seed --class=CurrencySeeder).');
        }

        return $code;
    }

    /**
     * The default currency, with the country it belongs to loaded.
     *
     * This is where an unplaceable shopper lands, so the country has to come
     * from the currency row rather than being derived: `countries.currency_code`
     * is many-to-one and inverting it picks an arbitrary country.
     */
    public static function default(): self
    {
        return static::query()
            ->where('is_default', true)
            ->with('country')
            ->firstOrFail();
    }
}
