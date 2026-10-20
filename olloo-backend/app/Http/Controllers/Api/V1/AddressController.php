<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Address;
use App\Models\City;
use App\Models\Country;
use App\Models\Region;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class AddressController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $addresses = Address::query()
            ->where('user_id', $user->id)
            ->orderByDesc('is_default')
            ->orderByDesc('id')
            ->with(['country', 'regionRecord', 'cityRecord'])
            ->get()
            ->map(fn (Address $address): array => $this->toArray($address))
            ->values()
            ->all();

        return response()->json(['addresses' => $addresses]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $this->validatedAddress($request);
        $geo = $this->resolveGeo($data);

        $address = DB::transaction(function () use ($user, $data, $geo): Address {
            $isDefault = (bool) ($data['isDefault'] ?? false);

            if ($isDefault || ! Address::query()->where('user_id', $user->id)->exists()) {
                $this->clearDefaults($user->id);
                $isDefault = true;
            }

            return Address::query()->create([
                'user_id' => $user->id,
                ...$geo,
                'first_name' => $data['firstName'],
                'last_name' => $data['lastName'],
                'phone_country_code' => $data['phoneCountryCode'],
                'phone_number' => $data['phoneNumber'],
                'address_line' => $data['addressLine'],
                'city_line' => $data['cityLine'] ?? null,
                'is_default' => $isDefault,
            ]);
        });

        return response()->json($this->toArray($address), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $address = $this->findOwned($user->id, $id);
        $data = $this->validatedAddress($request, partial: true);

        // Any change to the place re-resolves the whole country/region/city set.
        $geo = array_intersect_key($data, array_flip(['country', 'regionId', 'region', 'cityId', 'city'])) !== []
            ? $this->resolveGeo([
                'country' => $data['country'] ?? $address->country_id,
                'regionId' => $data['regionId'] ?? null,
                'region' => $data['region'] ?? $address->region,
                'cityId' => $data['cityId'] ?? null,
                'city' => $data['city'] ?? $address->city,
            ])
            : [];

        DB::transaction(function () use ($user, $address, $data, $geo): void {
            $updates = $geo;

            $map = [
                'firstName' => 'first_name',
                'lastName' => 'last_name',
                'phoneCountryCode' => 'phone_country_code',
                'phoneNumber' => 'phone_number',
                'addressLine' => 'address_line',
                'cityLine' => 'city_line',
            ];

            foreach ($map as $input => $column) {
                if (array_key_exists($input, $data)) {
                    $updates[$column] = $data[$input];
                }
            }

            if (array_key_exists('isDefault', $data) && $data['isDefault']) {
                $this->clearDefaults($user->id);
                $updates['is_default'] = true;
            } elseif (array_key_exists('isDefault', $data) && ! $data['isDefault']) {
                $updates['is_default'] = false;
            }

            if ($updates !== []) {
                $address->update($updates);
            }
        });

        return response()->json($this->toArray($address->fresh()));
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $address = $this->findOwned($user->id, $id);
        $wasDefault = (bool) $address->is_default;

        $address->delete();

        if ($wasDefault) {
            $next = Address::query()
                ->where('user_id', $user->id)
                ->orderByDesc('id')
                ->first();

            if ($next) {
                $next->update(['is_default' => true]);
            }
        }

        return response()->json(['success' => true]);
    }

    public function setDefault(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $address = $this->findOwned($user->id, $id);

        DB::transaction(function () use ($user, $address): void {
            $this->clearDefaults($user->id);
            $address->update(['is_default' => true]);
        });

        return response()->json($this->toArray($address->fresh()));
    }

    public function duplicate(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $source = $this->findOwned($user->id, $id);

        $copy = Address::query()->create([
            'user_id' => $user->id,
            'country_id' => $source->country_id,
            'region_id' => $source->region_id,
            'city_id' => $source->city_id,
            'first_name' => $source->first_name,
            'last_name' => $source->last_name,
            'phone_country_code' => $source->phone_country_code,
            'phone_number' => $source->phone_number,
            'address_line' => $source->address_line,
            'region' => $source->region,
            'city' => $source->city,
            'city_line' => $source->city_line,
            'is_default' => false,
        ]);

        return response()->json($this->toArray($copy), 201);
    }

    public function lookupCountries(): JsonResponse
    {
        $countries = Country::query()
            ->orderBy('name')
            ->get()
            ->map(fn (Country $country): array => [
                'rid' => $country->rid,
                'code' => $country->code,
                'name' => $country->name,
                'phoneCode' => $country->phone_code,
            ])
            ->values()
            ->all();

        return response()->json(['countries' => $countries]);
    }

    public function lookupRegions(Request $request): JsonResponse
    {
        $countryKey = trim((string) $request->query('country', ''));
        if ($countryKey === '') {
            return api_error('country_required', 'Provide country as a code or rid.', 422);
        }

        $country = Country::query()
            ->where(function ($q) use ($countryKey): void {
                $q->where('code', strtoupper($countryKey))
                    ->orWhere('rid', $countryKey);
            })
            ->first();

        if (! $country) {
            return api_error('country_not_found', 'Country not found.', 404);
        }

        $regions = Region::query()
            ->where('country_id', $country->id)
            ->orderBy('name')
            ->get()
            ->map(fn (Region $region): array => [
                'rid' => $region->rid,
                'name' => $region->name,
                'countryRid' => $country->rid,
            ])
            ->values()
            ->all();

        return response()->json(['regions' => $regions]);
    }

    public function lookupCities(Request $request): JsonResponse
    {
        $regionRid = trim((string) $request->query('region', ''));
        if ($regionRid === '') {
            return api_error('region_required', 'Provide region as a rid.', 422);
        }

        $region = Region::query()->where('rid', $regionRid)->first();

        if (! $region) {
            return api_error('region_not_found', 'Region not found.', 404);
        }

        $cities = City::query()
            ->where('region_id', $region->id)
            ->orderBy('name')
            ->get()
            ->map(fn (City $city): array => [
                'rid' => $city->rid,
                'name' => $city->name,
                'regionRid' => $region->rid,
            ])
            ->values()
            ->all();

        return response()->json(['cities' => $cities]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedAddress(Request $request, bool $partial = false): array
    {
        $required = $partial ? ['sometimes'] : ['required'];

        return $request->validate([
            // ISO code (AE), country rid, or exact country name.
            'country' => [...$required, 'string', 'max:120'],
            'regionId' => ['nullable', 'string', 'max:32'],
            'cityId' => ['nullable', 'string', 'max:32'],
            'firstName' => [...$required, 'string', 'max:120'],
            'lastName' => [...$required, 'string', 'max:120'],
            'phoneCountryCode' => [...$required, 'string', 'max:16'],
            'phoneNumber' => [...$required, 'string', 'max:40'],
            'addressLine' => [...$required, 'string', 'max:255'],
            'region' => [$partial ? 'sometimes' : 'required_without:regionId', 'string', 'max:120'],
            'city' => [$partial ? 'sometimes' : 'required_without:cityId', 'string', 'max:120'],
            'cityLine' => ['nullable', 'string', 'max:120'],
            'isDefault' => ['sometimes', 'boolean'],
        ]);
    }

    /**
     * Turn the submitted place into stored references. The country must be a
     * known one (shipping rules match on its ISO code). Region and city link
     * to the lookup lists when they match; otherwise the typed name is kept.
     *
     * @param  array<string, mixed>  $data
     * @return array{country_id: int, region_id: int|null, region: string, city_id: int|null, city: string}
     */
    private function resolveGeo(array $data): array
    {
        $country = is_int($data['country'])
            ? Country::query()->find($data['country'])
            : Country::resolve((string) $data['country']);

        if (! $country instanceof Country) {
            throw ValidationException::withMessages([
                'country' => 'Unknown country. Use an ISO code such as AE, or a country from GET /addresses/lookup/countries.',
            ]);
        }

        $region = null;
        if (! empty($data['regionId'])) {
            $region = Region::query()->where('rid', $data['regionId'])->where('country_id', $country->id)->first();
            if (! $region instanceof Region) {
                throw ValidationException::withMessages(['regionId' => 'That region is not in the selected country.']);
            }
        } elseif (trim((string) ($data['region'] ?? '')) !== '') {
            $region = Region::query()
                ->where('country_id', $country->id)
                ->whereRaw('lower(name) = ?', [mb_strtolower(trim((string) $data['region']))])
                ->first();
        }

        $city = null;
        if (! empty($data['cityId'])) {
            $city = City::query()->where('rid', $data['cityId'])->where('region_id', $region?->id)->first();
            if (! $city instanceof City) {
                throw ValidationException::withMessages(['cityId' => 'That city is not in the selected region.']);
            }
        } elseif ($region instanceof Region && trim((string) ($data['city'] ?? '')) !== '') {
            $city = City::query()
                ->where('region_id', $region->id)
                ->whereRaw('lower(name) = ?', [mb_strtolower(trim((string) $data['city']))])
                ->first();
        }

        $regionName = $region?->name ?? trim((string) ($data['region'] ?? ''));
        $cityName = $city?->name ?? trim((string) ($data['city'] ?? ''));

        if ($regionName === '' || $cityName === '') {
            throw ValidationException::withMessages(array_filter([
                'region' => $regionName === '' ? 'Enter a region, or pick one with regionId.' : null,
                'city' => $cityName === '' ? 'Enter a city, or pick one with cityId.' : null,
            ]));
        }

        return [
            'country_id' => $country->id,
            'region_id' => $region?->id,
            'region' => $regionName,
            'city_id' => $city?->id,
            'city' => $cityName,
        ];
    }

    private function findOwned(int $userId, string $rid): Address
    {
        $address = Address::query()
            ->where('user_id', $userId)
            ->where('rid', $rid)
            ->first();

        if (! $address) {
            abort(api_error('address_not_found', 'Address not found.', 404));
        }

        return $address;
    }

    private function clearDefaults(int $userId): void
    {
        Address::query()
            ->where('user_id', $userId)
            ->where('is_default', true)
            ->update(['is_default' => false]);
    }

    /**
     * @return array<string, mixed>
     */
    private function toArray(Address $address): array
    {
        return [
            'rid' => $address->rid,
            'country' => $address->country->name,
            'countryCode' => $address->country->code,
            'countryRid' => $address->country->rid,
            'regionRid' => $address->regionRecord?->rid,
            'cityRid' => $address->cityRecord?->rid,
            'firstName' => $address->first_name,
            'lastName' => $address->last_name,
            'phoneCountryCode' => $address->phone_country_code,
            'phoneNumber' => $address->phone_number,
            'addressLine' => $address->address_line,
            'region' => $address->region,
            'city' => $address->city,
            'cityLine' => $address->city_line,
            'isDefault' => (bool) $address->is_default,
        ];
    }
}
