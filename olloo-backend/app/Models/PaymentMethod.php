<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasImageUrl;
use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PaymentMethod extends Model
{
    use HasImageUrl;
    use HasRid;

    protected $fillable = [
        'rid',
        'code',
        'label',
        'provider',
        'icon',
        'currencies',
        'countries',
        'sort_order',
        'is_active',
        'is_fallback',
    ];

    protected $hidden = [
        'id',
    ];

    protected $appends = [
        'iconUrl',
    ];

    protected function casts(): array
    {
        return [
            'currencies' => 'array',
            'countries' => 'array',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
            'is_fallback' => 'boolean',
        ];
    }

    /**
     * Absolute icon URL when the icon is an uploaded path or external URL.
     * Short artwork keys (card, tabby, ...) resolve to null so the frontend
     * keeps mapping them to its brand assets.
     */
    public function getIconUrlAttribute(): ?string
    {
        $icon = is_string($this->icon) ? trim($this->icon) : '';

        if ($icon === '' || ! str_contains($icon, '/')) {
            return null;
        }

        return $this->absoluteUrlFor($icon);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * @return list<string>
     */
    public function currencyList(): array
    {
        return array_values(array_filter(array_map(
            fn (mixed $code): string => strtoupper(trim((string) $code)),
            (array) $this->currencies,
        )));
    }

    /**
     * @return list<string>
     */
    public function countryList(): array
    {
        return array_values(array_filter(array_map(
            fn (mixed $code): string => strtoupper(trim((string) $code)),
            (array) $this->countries,
        )));
    }

    /**
     * Empty currencies means every currency; empty countries means every
     * destination. Inactive methods never serve.
     */
    public function supports(string $currency, ?string $country = null): bool
    {
        if (! $this->is_active) {
            return false;
        }

        $currencies = $this->currencyList();
        if ($currencies !== [] && ! in_array(strtoupper($currency), $currencies, true)) {
            return false;
        }

        $countries = $this->countryList();
        if ($country !== null && $countries !== [] && ! in_array(strtoupper($country), $countries, true)) {
            return false;
        }

        return true;
    }
}
