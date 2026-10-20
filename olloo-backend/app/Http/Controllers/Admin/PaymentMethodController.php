<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Country;
use App\Models\Currency;
use App\Models\PaymentMethod;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Checkout payment methods (how shoppers pay) and the currencies that route
 * them to providers. A method names its provider plus the currencies and
 * countries it serves; checkout resolves by method plus order currency.
 */
final class PaymentMethodController extends Controller
{
    public function index(Request $request): Response
    {
        $this->authorizePayments($request);

        return Inertia::render('Admin/Settings/PaymentMethods/Index', [
            'methods' => PaymentMethod::query()
                ->withCount('payments')
                ->orderBy('sort_order')
                ->orderBy('label')
                ->get()
                ->map(fn (PaymentMethod $method): array => [
                    'rid' => $method->rid,
                    'code' => $method->code,
                    'label' => $method->label,
                    'provider' => $method->provider,
                    'icon' => $method->icon,
                    'iconUrl' => $method->icon_url,
                    'currencies' => $method->currencyList(),
                    'countries' => $method->countryList(),
                    'sortOrder' => $method->sort_order,
                    'isActive' => $method->is_active,
                    'isFallback' => (bool) $method->is_fallback,
                    'paymentsCount' => $method->payments_count,
                ])
                ->values(),
            'providers' => array_keys((array) config('payments.providers', [])),
            'countryOptions' => Country::query()->orderBy('name')->get(['code', 'name'])->map->only(['code', 'name'])->values(),
            'currencies' => Currency::query()->orderBy('code')->get()->map(fn (Currency $currency): array => [
                'rid' => $currency->rid,
                'code' => $currency->code,
                'name' => $currency->name,
                'provider' => $currency->payment_provider,
                'isDefault' => $currency->is_default,
            ])->values(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->authorizePayments($request);
        PaymentMethod::query()->create($this->validated($request));

        return back()->with('success', 'Payment method added.');
    }

    public function update(Request $request, PaymentMethod $paymentMethod): RedirectResponse
    {
        $this->authorizePayments($request);
        $paymentMethod->update($this->validated($request, $paymentMethod));

        return back()->with('success', "Payment method \"{$paymentMethod->label}\" saved.");
    }

    public function destroy(Request $request, PaymentMethod $paymentMethod): RedirectResponse
    {
        $this->authorizePayments($request);

        if ($paymentMethod->payments()->exists()) {
            return back()->with('error', "\"{$paymentMethod->label}\" already has payments. Turn it off instead of deleting it.");
        }

        $paymentMethod->delete();

        return back()->with('success', "Payment method \"{$paymentMethod->label}\" deleted.");
    }

    public function toggle(Request $request, PaymentMethod $paymentMethod): RedirectResponse
    {
        $this->authorizePayments($request);
        $paymentMethod->update(['is_active' => ! $paymentMethod->is_active]);

        return back()->with('success', $paymentMethod->is_active
            ? "\"{$paymentMethod->label}\" is now offered at checkout."
            : "\"{$paymentMethod->label}\" is hidden from checkout.");
    }

    /**
     * Point a currency at a provider, or move the store default. The default
     * feeds new carts and products; methods keep routing their own pairs.
     */
    public function updateCurrency(Request $request, Currency $currency): RedirectResponse
    {
        $this->authorizePayments($request);

        $data = $request->validate([
            'provider' => ['required', 'string', Rule::in(array_keys((array) config('payments.providers', [])))],
            'is_default' => ['required', 'boolean'],
        ], [
            'provider.in' => 'Pick a configured provider.',
        ]);

        if ((bool) $data['is_default'] === false && $currency->is_default
            && Currency::query()->where('is_default', true)->count() <= 1) {
            return back()->with('error', 'The store needs one default currency. Move it to another currency first.');
        }

        DB::transaction(function () use ($currency, $data): void {
            if ((bool) $data['is_default']) {
                Currency::query()->where('code', '!=', $currency->code)->update(['is_default' => false]);
            }

            $currency->update([
                'payment_provider' => $data['provider'],
                'is_default' => (bool) $data['is_default'],
            ]);
        });

        return back()->with('success', "Currency {$currency->code} saved.");
    }

    private function authorizePayments(Request $request): void
    {
        abort_unless($request->user('staff')?->can('manage_payment_settings'), 403);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?PaymentMethod $method = null): array
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:60', 'regex:/^[a-z0-9_]+$/', Rule::unique('payment_methods', 'code')->ignore($method?->id)],
            'label' => ['required', 'string', 'max:120'],
            'provider' => ['required', 'string', Rule::in(array_keys((array) config('payments.providers', [])))],
            'icon' => ['nullable', 'string', 'max:2048'],
            'currencies' => ['nullable', 'array', 'max:30'],
            'currencies.*' => ['required', 'string', 'size:3', 'exists:currencies,code', 'distinct'],
            'countries' => ['nullable', 'array', 'max:250'],
            'countries.*' => ['required', 'string', 'size:2', 'exists:countries,code', 'distinct'],
            'sort_order' => ['required', 'integer', 'min:0'],
            'is_active' => ['required', 'boolean'],
            'is_fallback' => ['required', 'boolean'],
        ], [
            'code.regex' => 'Use lowercase letters, numbers and underscores, for example "mtn_momo".',
            'code.unique' => 'Another payment method already uses this code.',
            'provider.in' => 'Pick a configured provider.',
        ]);

        return [
            'code' => trim($data['code']),
            'label' => trim($data['label']),
            'provider' => $data['provider'],
            'icon' => isset($data['icon']) && trim($data['icon']) !== '' ? trim($data['icon']) : null,
            'currencies' => array_values(array_unique(array_map('strtoupper', $data['currencies'] ?? []))) ?: null,
            'countries' => array_values(array_unique(array_map('strtoupper', $data['countries'] ?? []))) ?: null,
            'sort_order' => (int) $data['sort_order'],
            'is_active' => (bool) $data['is_active'],
            'is_fallback' => (bool) $data['is_fallback'],
        ];
    }
}
