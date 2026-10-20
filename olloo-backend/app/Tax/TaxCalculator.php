<?php

declare(strict_types=1);

namespace App\Tax;

use App\Models\TaxRate;
use Illuminate\Support\Collection;

/**
 * Tax on tax-exclusive prices for a destination country.
 *
 * - Only the destination's active rates apply; a country without rates is
 *   not taxed (the store collects where it is registered).
 * - A rate applies to lines of its tax class (NULL = standard). Shipping is
 *   taxed as a standard line, by rates marked applies_to_shipping.
 * - A compound rate is charged on the line plus the non-compound taxes before
 *   it (sort order), as with levies that VAT is charged on.
 * - Rounding: per line and per component, half up, in minor units.
 */
final class TaxCalculator
{
    /** @var array<string, Collection<int, TaxRate>> */
    private array $ratesByCountry = [];

    /**
     * @param  list<TaxLine>  $lines
     * @return array{
     *     totalMinor: int,
     *     shippingTaxMinor: int,
     *     perLine: array<string, int>,
     *     components: list<array{name: string, country: string, rateBp: int, isCompound: bool, taxableMinor: int, amountMinor: int}>
     * }|null  null when the destination is unknown
     */
    public function calculate(?string $country, array $lines, int $shippingMinor = 0): ?array
    {
        if ($country === null) {
            return null;
        }

        $rates = $this->ratesFor($country);
        $components = [];
        $perLine = [];

        foreach ($lines as $line) {
            $perLine[$line->key] = $this->taxAmount($line->amountMinor, $line->taxClassId, false, $rates, $components);
        }

        $shippingTax = $shippingMinor > 0 ? $this->taxAmount($shippingMinor, null, true, $rates, $components) : 0;

        return [
            'totalMinor' => array_sum($perLine) + $shippingTax,
            'shippingTaxMinor' => $shippingTax,
            'perLine' => $perLine,
            'components' => array_values(array_map(fn (array $component) => [
                'name' => $component['rate']->name,
                'country' => $component['rate']->country,
                'rateBp' => $component['rate']->rate_bp,
                'isCompound' => $component['rate']->is_compound,
                'taxableMinor' => $component['taxableMinor'],
                'amountMinor' => $component['amountMinor'],
            ], $components)),
        ];
    }

    /**
     * Combined rate a standard or classed line pays at the destination, in
     * basis points (compounding included), for price-with-tax display.
     */
    public function effectiveRateBp(string $country, ?int $taxClassId): int
    {
        $components = [];

        return (int) round($this->taxAmount(1_000_000, $taxClassId, false, $this->ratesFor($country), $components) / 100);
    }

    /**
     * @param  Collection<int, TaxRate>  $rates
     * @param  array<int, array{rate: TaxRate, taxableMinor: int, amountMinor: int}>  $components
     */
    private function taxAmount(int $amount, ?int $taxClassId, bool $isShipping, Collection $rates, array &$components): int
    {
        $simpleTax = 0;
        $total = 0;

        foreach ($rates as $rate) {
            if ($rate->tax_class_id !== $taxClassId || ($isShipping && ! $rate->applies_to_shipping)) {
                continue;
            }

            $base = $rate->is_compound ? $amount + $simpleTax : $amount;
            $tax = (int) round($base * $rate->rate_bp / 10000);

            if (! $rate->is_compound) {
                $simpleTax += $tax;
            }
            $total += $tax;

            $components[$rate->id] ??= ['rate' => $rate, 'taxableMinor' => 0, 'amountMinor' => 0];
            $components[$rate->id]['taxableMinor'] += $base;
            $components[$rate->id]['amountMinor'] += $tax;
        }

        return $total;
    }

    /**
     * @return Collection<int, TaxRate>
     */
    private function ratesFor(string $country): Collection
    {
        return $this->ratesByCountry[$country] ??= TaxRate::query()
            ->where('country', strtoupper($country))
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();
    }
}
