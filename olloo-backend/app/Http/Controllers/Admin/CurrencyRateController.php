<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Currency\ExchangeRateUpdater;
use App\Currency\MarkupSettings;
use App\Http\Controllers\Controller;
use App\Models\Currency;
use App\Models\CurrencyConversion;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

/**
 * Exchange rates and the markup added on top of them. Rates come from
 * `currency:update-rates` (twice daily); staff set the store default markup
 * and optional per-pair overrides.
 */
final class CurrencyRateController extends Controller
{
    public function __construct(
        private readonly MarkupSettings $markup,
    ) {}

    public function index(Request $request): Response
    {
        $this->authorizeCurrencies($request);

        $defaultMarkup = $this->markup->defaultPercent();
        $maxAgeHours = (int) config('currency.max_rate_age_hours');
        $staleBefore = now()->subHours($maxAgeHours);

        return Inertia::render('Admin/Settings/Currencies/Index', [
            'currencies' => Currency::query()->orderByDesc('is_default')->orderBy('code')->get()->map(fn (Currency $currency) => [
                'code' => $currency->code,
                'name' => $currency->name,
                'countryCode' => $currency->country_code,
                'countryName' => $currency->country?->name,
                'paymentProvider' => $currency->payment_provider,
                'decimalPlaces' => $currency->decimal_places,
                'isDefault' => $currency->is_default,
            ])->values(),
            'pairs' => CurrencyConversion::query()
                ->orderBy('from_currency_code')
                ->orderBy('to_currency_code')
                ->get()
                ->map(function (CurrencyConversion $pair) use ($defaultMarkup, $staleBefore) {
                    $markup = $pair->markup_percent !== null ? (float) $pair->markup_percent : $defaultMarkup;

                    return [
                        'rid' => $pair->rid,
                        'from' => $pair->from_currency_code,
                        'to' => $pair->to_currency_code,
                        'midRate' => (float) $pair->rate,
                        'markupOverride' => $pair->markup_percent !== null ? (float) $pair->markup_percent : null,
                        'effectiveRate' => (float) $pair->rate * (1 + $markup / 100),
                        'fetchedAt' => $pair->fetched_at->toIso8601String(),
                        'isStale' => $pair->fetched_at->lt($staleBefore),
                        'source' => $pair->source,
                    ];
                })
                ->values(),
            'defaultMarkupPercent' => $defaultMarkup,
            'defaultMarkupSaved' => $this->markup->isStored(),
            'maxRateAgeHours' => $maxAgeHours,
            'usesApiKey' => filled(config('services.exchange_rate.api_key')),
        ]);
    }

    public function updateDefaultMarkup(Request $request): RedirectResponse
    {
        $this->authorizeCurrencies($request);

        $data = $request->validate([
            'default_markup_percent' => ['required', 'numeric', 'min:0', 'max:50'],
        ]);

        $this->markup->saveDefaultPercent((float) $data['default_markup_percent']);

        return back()->with('success', 'Default markup saved. New prices and orders use it right away.');
    }

    public function updatePair(Request $request, CurrencyConversion $currencyConversion): RedirectResponse
    {
        $this->authorizeCurrencies($request);

        $data = $request->validate([
            'markup_percent' => ['nullable', 'numeric', 'min:0', 'max:50'],
        ]);

        $currencyConversion->update(['markup_percent' => $data['markup_percent'] ?? null]);

        return back()->with('success', "Markup for {$currencyConversion->from_currency_code} to {$currencyConversion->to_currency_code} saved.");
    }

    public function refresh(Request $request, ExchangeRateUpdater $updater): RedirectResponse
    {
        $this->authorizeCurrencies($request);

        try {
            $result = $updater->update();
        } catch (RuntimeException $e) {
            return back()->with('error', 'Rates were not updated: '.$e->getMessage());
        }

        if ($result['missing'] !== []) {
            return back()->with('error', "Updated {$result['pairs']} pairs, but the provider has no rate for ".implode(', ', $result['missing']).'. Shoppers in those currencies see '.$result['base'].'.');
        }

        return back()->with('success', "Updated {$result['pairs']} pairs from {$result['source']}.");
    }

    private function authorizeCurrencies(Request $request): void
    {
        abort_unless($request->user('staff')?->can('manage_currency_settings'), 403);
    }
}
