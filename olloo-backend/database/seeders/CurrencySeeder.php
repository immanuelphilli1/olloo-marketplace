<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Currency;
use Illuminate\Database\Seeder;

class CurrencySeeder extends Seeder
{
    /**
     * The provider is pinned per currency, never derived from a global
     * default: a gateway only carries the currencies its merchant account is
     * onboarded for. Routing AED to Paystack fails with "No active channel to
     * process transaction", so USD and AED are Stripe and GHS is Paystack.
     *
     * USD is the default because the catalogue is priced in USD. It is also the
     * fallback for every market we do not sell in locally, so a shopper in a
     * country with no currency of its own here still sees and pays dollars.
     *
     * `country_code` is the currency's own market and is explicit rather than
     * derived from `countries.currency_code`: that column is many-to-one, and
     * inverting it puts an unplaceable shopper in whichever of the 18 USD
     * countries sorts first. It also makes this seeder the authority on the
     * country rows the default currency needs, which GeoSeeder creates.
     */
    public function run(): void
    {
        $this->currency('USD', 'US Dollar', 'US', 'stripe', 2, true);
        $this->currency('AED', 'UAE Dirham', 'AE', 'stripe', 2, false);
        $this->currency('GHS', 'Ghanaian Cedi', 'GH', 'paystack', 2, false);
    }

    /**
     * `payment_provider` and `is_default` are only written when the row is new.
     *
     * The admin Currencies page exposes both for staff to change, so this
     * seeder runs on every deploy (ProductionDatabaseSeeder) and overwriting
     * them would revert that work on each release: USD would take the default
     * back off a currency staff had promoted, and a deliberate provider change
     * would be undone. Existing rows only get `country_code` backfilled, which
     * is a new column that a pre-existing install cannot have set.
     */
    private function currency(string $code, string $name, string $country, string $provider, int $places, bool $isDefault): void
    {
        $currency = Currency::query()->firstOrNew(['code' => $code]);

        if (! $currency->exists) {
            $currency->fill([
                'name' => $name,
                'country_code' => $country,
                'payment_provider' => $provider,
                'decimal_places' => $places,
                'is_default' => $isDefault,
            ]);
        } elseif ($currency->country_code === null) {
            $currency->country_code = $country;
        }

        $currency->save();
    }
}
