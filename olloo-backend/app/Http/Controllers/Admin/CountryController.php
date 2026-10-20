<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\SyncCountriesJob;
use App\Models\Country;
use App\Models\Region;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Read-only country list. Rows come from `countries:sync`; addresses and
 * shipping rules reference them by ISO code.
 */
class CountryController extends Controller
{
    private const SEARCH_FIELDS = ['name', 'code', 'region'];

    public function index(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('view_countries'), 403);

        $search = trim($request->string('search')->toString());
        $searchBy = $request->string('search_by')->toString();
        if (! in_array($searchBy, self::SEARCH_FIELDS, true)) {
            $searchBy = 'name';
        }

        $countries = Country::query()
            ->withCount(['regions', 'addresses'])
            ->when($search !== '', fn ($query) => $query->where($searchBy, 'like', '%'.$search.'%'))
            ->orderBy('name')
            ->paginate((int) config('admin.per_page'))
            ->withQueryString()
            ->through(fn (Country $country) => $this->serialize($country));

        return Inertia::render('Admin/Countries/Index', [
            'countries' => $countries,
            'filters' => ['search' => $search, 'search_by' => $searchBy],
            'lastSyncedAt' => Country::query()->max('synced_at'),
            'syncConfigured' => filled(config('services.restcountries.api_key')),
            'canSync' => (bool) $request->user('staff')?->can('sync_countries'),
        ]);
    }

    public function show(Request $request, Country $country): Response
    {
        abort_unless($request->user('staff')?->can('view_countries'), 403);

        $country->loadCount(['regions', 'addresses']);

        return Inertia::render('Admin/Countries/Show', [
            'country' => [
                ...$this->serialize($country),
                'regions' => $country->regions()
                    ->withCount('cities')
                    ->orderBy('name')
                    ->get()
                    ->map(fn (Region $region) => [
                        'rid' => $region->rid,
                        'name' => $region->name,
                        'citiesCount' => $region->cities_count,
                    ])
                    ->values()
                    ->all(),
            ],
        ]);
    }

    public function sync(Request $request): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('sync_countries'), 403);

        if (blank(config('services.restcountries.api_key'))) {
            return back()->with('error', 'Country sync is not configured. Set RESTCOUNTRIES_API_KEY in the server environment.');
        }

        SyncCountriesJob::dispatch();

        return redirect()
            ->route('admin.countries.index')
            ->with('success', 'Country sync queued. Refresh in a minute to see the updated list.');
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(Country $country): array
    {
        return [
            'rid' => $country->rid,
            'code' => $country->code,
            'alpha3' => $country->alpha3,
            'name' => $country->name,
            'region' => $country->region,
            'phoneCode' => $country->phone_code,
            'currencyCode' => $country->currency_code,
            'flag' => $country->flag,
            'syncedAt' => $country->synced_at?->toIso8601String(),
            'regionsCount' => $country->regions_count ?? null,
            'addressesCount' => $country->addresses_count ?? null,
        ];
    }
}
