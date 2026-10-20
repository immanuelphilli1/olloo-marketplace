<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\PaymentMethod;
use Illuminate\Database\Seeder;

/**
 * Default checkout methods.
 *
 * Provider, currency and country are pinned per row rather than read from the
 * currencies table, because a method routes to exactly one gateway: UAE (AED/AE)
 * on Stripe, Ghana (GHS/GH) on Paystack. Every active row is scoped to a
 * currency, so PaymentMethod::supports() keeps checkout from ever offering a
 * method the cart cannot settle with.
 *
 * The USD rows are the exception, and are marked is_fallback. They take no
 * country and serve as the last resort for a market with no rows of its own,
 * so a shopper never meets an empty payment list. They are only ever offered
 * when nothing scoped matches, and only when their gateway is the one that
 * already handles this currency, so they cannot paper over a real routing gap.
 *
 * Reseeding preserves staff edits to label, icon, sort_order and is_active, and
 * re-asserts provider/currencies/countries/is_fallback on rows that are live. A
 * wrong provider is not a preference: the gateway rejects the currency at
 * checkout ("No active channel to process transaction"), so leaving it to staff
 * edits is how that failure ships. Corrections are reported on the console
 * rather than applied silently. Inactive rows are left untouched so a parked
 * method keeps whatever staff were trialling.
 *
 * Apple Pay and Google Pay ride on Stripe Checkout (enable them in the Stripe
 * dashboard); mobile money rides on Paystack's hosted checkout for GHS.
 * PayPal, Tabby and Tamara start off until their credentials are configured.
 *
 * One row per (currency, country) market, so a method is never offered where
 * its gateway is not set up for that currency.
 */
class PaymentMethodSeeder extends Seeder
{
    /**
     * Fields the seed owns on live rows. Everything else is a staff preference.
     *
     * @var list<string>
     */
    private const ROUTING_FIELDS = ['provider', 'currencies', 'countries', 'is_fallback'];

    public function run(): void
    {
        // One row per (currency, country) market rather than one row per
        // currency. USD methods carry no country list because USD is what every
        // market we do not sell in locally falls back to, so a country list
        // would hide the card options from most of the people being charged in
        // dollars. An empty list means any country, which is also what
        // PaymentMethod::supports() reads it as.
        //
        // They are also the is_fallback set, so a shopper whose market has no
        // rows of its own still gets a way to pay instead of an empty list.
        $methods = [
            [
                'code' => 'usd_cards', 'label' => 'Card', 'provider' => 'stripe', 'icon' => '/images/payment-methods/card.svg',
                'currencies' => ['USD'], 'countries' => [], 'sort_order' => 0, 'is_active' => true, 'is_fallback' => true,
            ],
            [
                'code' => 'aed_cards', 'label' => 'Card', 'provider' => 'stripe', 'icon' => '/images/payment-methods/card.svg',
                'currencies' => ['AED'], 'countries' => ['AE'], 'sort_order' => 1, 'is_active' => true, 'is_fallback' => false,
            ],
            [
                'code' => 'apple_pay', 'label' => 'Apple Pay', 'provider' => 'stripe', 'icon' => '/images/payment-methods/apple-pay.svg',
                'currencies' => ['USD'], 'countries' => [], 'sort_order' => 2, 'is_active' => true, 'is_fallback' => true,
            ],
            [
                'code' => 'aed_apple_pay', 'label' => 'Apple Pay', 'provider' => 'stripe', 'icon' => '/images/payment-methods/apple-pay.svg',
                'currencies' => ['AED'], 'countries' => ['AE'], 'sort_order' => 3, 'is_active' => true, 'is_fallback' => false,
            ],
            [
                'code' => 'google_pay', 'label' => 'Google Pay', 'provider' => 'stripe', 'icon' => '/images/payment-methods/google-pay.svg',
                'currencies' => ['USD'], 'countries' => [], 'sort_order' => 4, 'is_active' => true, 'is_fallback' => true,
            ],
            [
                'code' => 'aed_google_pay', 'label' => 'Google Pay', 'provider' => 'stripe', 'icon' => '/images/payment-methods/google-pay.svg',
                'currencies' => ['AED'], 'countries' => ['AE'], 'sort_order' => 5, 'is_active' => true, 'is_fallback' => false,
            ],
            [
                'code' => 'ghs_cards', 'label' => 'Card', 'provider' => 'paystack', 'icon' => '/images/payment-methods/card.svg',
                'currencies' => ['GHS'], 'countries' => ['GH'], 'sort_order' => 6, 'is_active' => true, 'is_fallback' => false,
            ],
            [
                'code' => 'mobile_money', 'label' => 'Mobile Money', 'provider' => 'paystack', 'icon' => '/images/payment-methods/mobile-money.svg',
                'currencies' => ['GHS'], 'countries' => ['GH'], 'sort_order' => 7, 'is_active' => true, 'is_fallback' => false,
            ],
            [
                'code' => 'paypal', 'label' => 'PayPal', 'provider' => 'paypal', 'icon' => '/images/payment-methods/paypal.svg',
                'currencies' => ['AED'], 'countries' => ['AE'], 'sort_order' => 8, 'is_active' => false, 'is_fallback' => false,
            ],
            [
                'code' => 'tabby', 'label' => 'Tabby', 'provider' => 'tabby', 'icon' => '/images/payment-methods/tabby.svg',
                'currencies' => ['AED'], 'countries' => ['AE'], 'sort_order' => 9, 'is_active' => false, 'is_fallback' => false,
            ],
            [
                'code' => 'tamara', 'label' => 'Tamara', 'provider' => 'tamara', 'icon' => '/images/payment-methods/tamara.svg',
                'currencies' => ['AED'], 'countries' => ['AE'], 'sort_order' => 10, 'is_active' => false, 'is_fallback' => false,
            ],
        ];

        $repairs = [];

        foreach ($methods as $method) {
            $row = PaymentMethod::query()->firstOrCreate(['code' => $method['code']], $method);

            // Move legacy artwork keys to the seeded badges. Staff uploads
            // (paths and URLs, anything with a slash) are left alone.
            if (! str_contains((string) $row->icon, '/')) {
                $row->update(['icon' => $method['icon']]);
            }

            foreach ($this->routingDrift($row, $method) as $field => $seeded) {
                $repairs[] = sprintf(
                    '%s: %s %s -> %s',
                    $row->code,
                    $field,
                    $this->render($row->{$field}),
                    $this->render($seeded),
                );
                $row->update([$field => $seeded]);
            }
        }

        $repairs = [...$repairs, ...$this->retireLegacyCard()];

        if ($repairs !== []) {
            $this->command?->warn('Payment method routing corrected:');
            foreach ($repairs as $repair) {
                $this->command?->line('  - '.$repair);
            }
        }
    }

    /**
     * Routing fields on a live row that disagree with the seed.
     *
     * @param  array<string, mixed>  $method
     * @return array<string, mixed>
     */
    private function routingDrift(PaymentMethod $row, array $method): array
    {
        if (! $row->is_active) {
            return [];
        }

        $drift = [];

        foreach (self::ROUTING_FIELDS as $field) {
            if (! array_key_exists($field, $method)) {
                continue;
            }

            if ($this->normalize($field, $row->{$field}) !== $this->normalize($field, $method[$field])) {
                $drift[$field] = $method[$field];
            }
        }

        return $drift;
    }

    /**
     * Compare provider as a string, is_fallback as a bool, and code lists as
     * normalised, order-insensitive lists so `["AED"]` and `["AED"]` written with
     * different key order do not read as drift.
     */
    private function normalize(string $field, mixed $value): string|bool|array
    {
        if ($field === 'provider') {
            return strtolower(trim((string) $value));
        }

        if ($field === 'is_fallback') {
            // Cast, not truthiness: a column read back from MySQL can arrive as
            // 0/1 or "0"/"1", and the seed value is a real bool. Comparing raw
            // values would report drift on every deploy and rewrite the column
            // each time for no reason.
            return (bool) $value;
        }

        $codes = array_values(array_unique(array_filter(array_map(
            fn (mixed $code): string => strtoupper(trim((string) $code)),
            (array) $value,
        ))));
        sort($codes);

        return $codes;
    }

    private function render(mixed $value): string
    {
        return match (true) {
            is_array($value) => $value === [] ? '(any)' : '['.implode(',', $value).']',
            is_bool($value) => $value ? 'fallback' : 'scoped',
            default => (string) $value,
        };
    }

    /**
     * `card` was the original AED row and is now `aed_cards` + `ghs_cards`.
     * It is retired, not deleted: it stays as history for past payments, but
     * goes inactive so it can never be offered alongside its replacements.
     *
     * @return list<string>
     */
    private function retireLegacyCard(): array
    {
        $legacy = PaymentMethod::query()
            ->where('code', 'card')
            ->where('is_active', true)
            ->first();

        if (! $legacy instanceof PaymentMethod) {
            return [];
        }

        $legacy->update(['is_active' => false]);

        return ['card: retired, superseded by aed_cards and ghs_cards'];
    }
}
