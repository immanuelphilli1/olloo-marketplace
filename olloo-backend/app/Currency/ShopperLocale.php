<?php

declare(strict_types=1);

namespace App\Currency;

use App\Models\Country;
use App\Models\Currency;
use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * The shopper's country and the currency we price and charge them in.
 *
 * Country, in order:
 * 1. `?country=` on the request (ISO code, rid or name) — an explicit
 *    per-request instruction from the client, so it wins outright.
 * 2. The shopper's own `preferred_country` setting.
 * 3. The `assigned_country` we placed them in, detected from their IP the first
 *    time we saw them or set by staff.
 * 4. The current visitor IP.
 * 5. The default currency's own country (`currencies.country_code`).
 *
 * A signed-in shopper's stored choice beats their current IP, so their currency
 * does not change because they travelled or their connection moved. A guest has
 * neither setting, so they still get their IP.
 *
 * Currency: that country's currency when it is a configured row in `currencies`
 * with a fresh rate from the default currency; otherwise the default currency
 * (unsupported currencies are never shown or charged). Resolved once per
 * request: controllers are cached on their route, so a stored instance
 * re-resolves when the request changes.
 */
final class ShopperLocale
{
    public const SOURCE_QUERY = 'query';

    public const SOURCE_PREFERRED = 'preferred';

    public const SOURCE_ASSIGNED = 'assigned';

    public const SOURCE_IP = 'ip';

    public const SOURCE_DEFAULT = 'default';

    private ?Request $resolvedFor = null;

    private ?Country $country = null;

    private string $source = self::SOURCE_DEFAULT;

    private string $currency = '';

    public function __construct(
        private readonly GeoIpCountry $geo,
    ) {}

    public function currency(): string
    {
        $this->resolve();

        return $this->currency;
    }

    public function country(): ?Country
    {
        $this->resolve();

        return $this->country;
    }

    /** How the country was found: query, preferred, assigned, ip or default. */
    public function source(): string
    {
        $this->resolve();

        return $this->source;
    }

    /**
     * The resolved locale as the API reports it: the country, how it was found,
     * and the currency every amount is charged in.
     *
     * @return array{country: array{code: string, name: string, flag: string|null, currencyCode: string|null}|null, countrySource: string, currency: array{code: string, name: string, decimalPlaces: int}}
     */
    public function toArray(): array
    {
        $this->resolve();

        $currency = Currency::query()->where('code', $this->currency)->firstOrFail();

        return [
            'country' => $this->country instanceof Country ? [
                'code' => $this->country->code,
                'name' => $this->country->name,
                'flag' => $this->country->flag,
                'currencyCode' => $this->country->currency_code,
            ] : null,
            'countrySource' => $this->source,
            'currency' => [
                'code' => $currency->code,
                'name' => $currency->name,
                'decimalPlaces' => $currency->decimal_places,
            ],
        ];
    }

    /**
     * Resolve again on the next read.
     *
     * The answer is memoised per request because controllers are cached on their
     * route. That is right for reading a locale and wrong for changing one:
     * after a shopper sets a preferred country the memo still holds the old
     * answer, so whatever changes the input has to drop it.
     */
    public function forget(): void
    {
        $this->resolvedFor = null;
    }

    /**
     * Currency to show an amount stored in `$source` in: the shopper's, or the
     * amount's own when no usable rate exists (never a made-up conversion).
     */
    public function displayCurrencyFor(string $source): string
    {
        return app(CurrencyConverter::class)->canConvert($source, $this->currency()) ? $this->currency() : $source;
    }

    private function resolve(): void
    {
        $request = request();
        if ($this->resolvedFor === $request) {
            return;
        }

        $this->resolvedFor = $request;
        $default = Currency::defaultCode();

        [$this->country, $this->source] = $this->detectCountry($request);

        $local = $this->country?->currency_code;
        $this->currency = is_string($local)
            && $local !== $default
            && Currency::query()->where('code', $local)->exists()
            && app(CurrencyConverter::class)->canConvert($default, $local)
                ? $local
                : $default;
    }

    /**
     * @return array{0: Country|null, 1: string}
     */
    private function detectCountry(Request $request): array
    {
        $requested = trim((string) $request->query('country', ''));
        if ($requested !== '') {
            $country = Country::resolve($requested);
            if (! $country instanceof Country) {
                abort(api_error('country_not_found', 'Unknown country. Send an ISO code such as AE.', 422));
            }

            return [$country, self::SOURCE_QUERY];
        }

        // The shopper's own settings, preferred first. A setting naming a
        // country we do not know is ignored rather than fatal: it may predate
        // countries:sync, or name a country since removed, and a shopper should
        // not be locked out of the shop over a stale preference.
        $userId = $this->authenticatedUserId($request);

        if ($userId !== null) {
            foreach ([
                [UserSetting::PREFERRED_COUNTRY, self::SOURCE_PREFERRED],
                [UserSetting::ASSIGNED_COUNTRY, self::SOURCE_ASSIGNED],
            ] as [$setting, $source]) {
                $stored = UserSetting::valueFor($userId, $setting);
                if ($stored === null) {
                    continue;
                }

                $country = Country::query()->where('code', strtoupper($stored))->first();
                if ($country instanceof Country) {
                    return [$country, $source];
                }
            }
        }

        $code = $this->geo->countryCodeFor($request->ip());
        $country = $code !== null ? Country::query()->where('code', $code)->first() : null;
        if ($country instanceof Country) {
            // Place the shopper where they appear to be, so their next request
            // keeps this currency instead of re-reading the IP. Only when we
            // hold nothing already: see UserSetting::putIfAbsent.
            if ($userId !== null) {
                UserSetting::putIfAbsent($userId, UserSetting::ASSIGNED_COUNTRY, $country->code);
            }

            return [$country, self::SOURCE_IP];
        }

        return [$this->defaultCountry(), self::SOURCE_DEFAULT];
    }

    /**
     * Where an unplaceable shopper is put: the default currency's own country.
     *
     * `currencies.country_code` is explicit, one country per currency, so USD
     * lands in the US rather than in whichever country happens to sort first
     * among the 18 that share its currency. Deriving the other way round
     * (`countries.currency_code` matched to the default) resolved to American
     * Samoa on a synced database.
     *
     * A currency with no country set is a deployment gap, so it logs and answers
     * null: a currency that cannot be placed must still be sellable, and 500-ing
     * every storefront page over a missing code is worse than the null it fixes.
     */
    private function defaultCountry(): ?Country
    {
        $country = Currency::default()->country;

        if ($country instanceof Country) {
            return $country;
        }

        Log::warning('The default currency has no country_code, so unplaceable shoppers have no country. Set currencies.country_code (CurrencySeeder does).', [
            'currency' => Currency::defaultCode(),
        ]);

        return null;
    }

    /**
     * The signed-in shopper's id, or null for a guest.
     *
     * Only the sanctum guard counts: a staff member browsing the storefront in
     * the same browser should be priced as a visitor, not as the staff account
     * their admin session belongs to.
     */
    private function authenticatedUserId(Request $request): ?int
    {
        $user = $request->user('sanctum');

        return $user instanceof User ? (int) $user->id : null;
    }
}
