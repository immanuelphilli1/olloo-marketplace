<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\City;
use App\Models\Country;
use App\Models\Region;
use Illuminate\Database\Seeder;

/**
 * The countries the currencies we sell in belong to, plus their regions and
 * cities. `currency_code` is what ShopperLocale reads to decide the currency a
 * shopper is priced and charged in, so it has to be set here: leaving it NULL
 * silently sends every seeded shopper to the default currency.
 * `countries:sync` fills in the rest of the world.
 *
 * These rows are not optional decoration. `currencies.country_code` names them,
 * and a currency whose country is missing cannot place an unplaceable shopper,
 * so a store seeded without them answers `country: null` on every product page.
 * CurrencySeeder owns the mapping; this creates the other end of it.
 */
class GeoSeeder extends Seeder
{
    public function run(): void
    {
        $this->country('US', 'United States', '+1', 'USD');
        $uae = $this->country('AE', 'United Arab Emirates', '+971', 'AED');
        $ghana = $this->country('GH', 'Ghana', '+233', 'GHS');

        $uaeRegions = [
            'Dubai' => ['Dubai', 'Jebel Ali', 'Hatta'],
            'Abu Dhabi' => ['Abu Dhabi', 'Al Ain', 'Madinat Zayed'],
            'Sharjah' => ['Sharjah', 'Kalba', 'Khor Fakkan'],
            'Ajman' => ['Ajman'],
            'Ras Al Khaimah' => ['Ras Al Khaimah'],
            'Fujairah' => ['Fujairah'],
            'Umm Al Quwain' => ['Umm Al Quwain'],
        ];

        foreach ($uaeRegions as $regionName => $cities) {
            $region = Region::query()->updateOrCreate(
                [
                    'country_id' => $uae->id,
                    'name' => $regionName,
                ],
                [],
            );

            foreach ($cities as $cityName) {
                City::query()->updateOrCreate(
                    [
                        'region_id' => $region->id,
                        'name' => $cityName,
                    ],
                    [],
                );
            }
        }

        $ghanaRegions = [
            'Greater Accra' => ['Accra', 'Tema', 'Madina'],
            'Ashanti' => ['Kumasi', 'Obuasi'],
            'Western' => ['Takoradi', 'Sekondi'],
            'Central' => ['Cape Coast', 'Winneba'],
            'Northern' => ['Tamale'],
            'Eastern' => ['Koforidua'],
        ];

        foreach ($ghanaRegions as $regionName => $cities) {
            $region = Region::query()->updateOrCreate(
                [
                    'country_id' => $ghana->id,
                    'name' => $regionName,
                ],
                [],
            );

            foreach ($cities as $cityName) {
                City::query()->updateOrCreate(
                    [
                        'region_id' => $region->id,
                        'name' => $cityName,
                    ],
                    [],
                );
            }
        }
    }

    private function country(string $code, string $name, string $phoneCode, string $currencyCode): Country
    {
        return Country::query()->updateOrCreate(
            ['code' => $code],
            [
                'name' => $name,
                'phone_code' => $phoneCode,
                'currency_code' => $currencyCode,
            ],
        );
    }
}
