<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Country;
use App\Models\ShippingRule;
use App\Models\TaxClass;
use App\Models\TaxRate;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Tax rates per destination country and tax classes. Prices are stored
 * excluding tax; checkout adds the destination's rates.
 */
final class TaxController extends Controller
{
    public function index(Request $request): Response
    {
        $this->authorizeTax($request);

        $rates = TaxRate::query()->with('taxClass:id,rid,name')->orderBy('country')->orderBy('sort_order')->orderBy('id')->get();
        $taxedCountries = $rates->where('is_active', true)->pluck('country')->unique()->all();

        return Inertia::render('Admin/Settings/Taxes/Index', [
            'rates' => $rates->map(fn (TaxRate $rate) => [
                'rid' => $rate->rid,
                'name' => $rate->name,
                'country' => $rate->country,
                'taxClassRid' => $rate->taxClass?->rid,
                'taxClassName' => $rate->taxClass?->name,
                'ratePercent' => $rate->percent(),
                'isCompound' => $rate->is_compound,
                'appliesToShipping' => $rate->applies_to_shipping,
                'sortOrder' => $rate->sort_order,
                'isActive' => $rate->is_active,
            ])->values(),
            'classes' => TaxClass::query()->withCount(['products', 'rates'])->orderBy('name')->get()->map(fn (TaxClass $class) => [
                'rid' => $class->rid,
                'name' => $class->name,
                'productsCount' => $class->products_count,
                'ratesCount' => $class->rates_count,
            ])->values(),
            'countries' => Country::query()->orderBy('name')->get(['code', 'name'])->map->only(['code', 'name'])->values(),
            // Destinations that have shipping rules but no tax rate are sold to tax free.
            'untaxedShippingCountries' => ShippingRule::query()
                ->where('is_active', true)
                ->whereNotNull('country')
                ->whereNotIn('country', $taxedCountries)
                ->distinct()
                ->pluck('country')
                ->values(),
        ]);
    }

    public function storeRate(Request $request): RedirectResponse
    {
        $this->authorizeTax($request);
        TaxRate::query()->create($this->validatedRate($request));

        return back()->with('success', 'Tax rate added.');
    }

    public function updateRate(Request $request, TaxRate $taxRate): RedirectResponse
    {
        $this->authorizeTax($request);
        $taxRate->update($this->validatedRate($request));

        return back()->with('success', 'Tax rate saved.');
    }

    public function destroyRate(Request $request, TaxRate $taxRate): RedirectResponse
    {
        $this->authorizeTax($request);
        $taxRate->delete();

        return back()->with('success', "Tax rate \"{$taxRate->name}\" ({$taxRate->country}) deleted. Past orders keep the tax they charged.");
    }

    public function storeClass(Request $request): RedirectResponse
    {
        $this->authorizeTax($request);
        TaxClass::query()->create(['name' => $this->validatedClassName($request)]);

        return back()->with('success', 'Tax class added. Add rates for it, then pick it on products.');
    }

    public function updateClass(Request $request, TaxClass $taxClass): RedirectResponse
    {
        $this->authorizeTax($request);
        $taxClass->update(['name' => $this->validatedClassName($request, $taxClass)]);

        return back()->with('success', 'Tax class renamed.');
    }

    public function destroyClass(Request $request, TaxClass $taxClass): RedirectResponse
    {
        $this->authorizeTax($request);

        if ($taxClass->products()->exists() || $taxClass->rates()->exists()) {
            return back()->with('error', "\"{$taxClass->name}\" is still used by products or rates. Move them first.");
        }

        $taxClass->delete();

        return back()->with('success', "Tax class \"{$taxClass->name}\" deleted.");
    }

    private function authorizeTax(Request $request): void
    {
        abort_unless($request->user('staff')?->can('manage_tax_settings'), 403);
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedRate(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'country' => ['required', 'string', 'size:2', 'exists:countries,code'],
            'tax_class_rid' => ['nullable', 'string', 'exists:tax_classes,rid'],
            'rate_percent' => ['required', 'numeric', 'min:0', 'max:100', 'decimal:0,2'],
            'is_compound' => ['required', 'boolean'],
            'applies_to_shipping' => ['required', 'boolean'],
            'sort_order' => ['required', 'integer', 'min:0'],
            'is_active' => ['required', 'boolean'],
        ], [
            'name.required' => 'Name the tax as it appears on receipts, for example "VAT".',
            'country.exists' => 'Pick a country from the list.',
            'rate_percent.decimal' => 'Use at most two decimals, for example 2.5.',
        ]);

        return [
            'name' => trim($data['name']),
            'country' => strtoupper($data['country']),
            'tax_class_id' => ! empty($data['tax_class_rid']) ? TaxClass::query()->where('rid', $data['tax_class_rid'])->value('id') : null,
            'rate_bp' => (int) round((float) $data['rate_percent'] * 100),
            'is_compound' => (bool) $data['is_compound'],
            'applies_to_shipping' => (bool) $data['applies_to_shipping'],
            'sort_order' => (int) $data['sort_order'],
            'is_active' => (bool) $data['is_active'],
        ];
    }

    private function validatedClassName(Request $request, ?TaxClass $class = null): string
    {
        return trim($request->validate([
            'name' => ['required', 'string', 'max:80', Rule::unique('tax_classes', 'name')->ignore($class?->id)],
        ], [
            'name.unique' => 'Another tax class already has this name.',
        ])['name']);
    }
}
