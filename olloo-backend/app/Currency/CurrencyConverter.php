<?php

declare(strict_types=1);

namespace App\Currency;

use App\Models\Currency;
use App\Models\CurrencyConversion;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Converts minor-unit amounts between configured currencies at the stored
 * mid-market rate plus markup (pair override, else the store default).
 * Shopper-facing amounts round up to the next minor unit, so rounding never
 * costs us. Rates and currencies are read once per request; a stored
 * instance (controllers are cached on their route) reloads when it changes.
 */
final class CurrencyConverter
{
    /** @var array<string, int>|null */
    private ?array $decimals = null;

    /** @var array<string, CurrencyConversion>|null */
    private ?array $rows = null;

    private ?float $defaultMarkup = null;

    private ?Request $loadedFor = null;

    /** @var array<string, ExchangeRate> */
    private array $used = [];

    public function __construct(
        private readonly MarkupSettings $markup,
    ) {}

    /**
     * The rate a shopper is charged for this direction. Throws when no rate is
     * stored or it is older than currency.max_rate_age_hours.
     */
    public function rate(string $from, string $to): ExchangeRate
    {
        $rate = $this->lookup($from, $to);
        $this->used[$from.':'.$to] = $rate;

        return $rate;
    }

    public function canConvert(string $from, string $to): bool
    {
        try {
            $this->lookup($from, $to);

            return true;
        } catch (ExchangeRateUnavailable) {
            return false;
        }
    }

    /** Shopper-facing conversion, rounded up to the target's minor unit. */
    public function convert(int $minor, string $from, string $to): int
    {
        if ($from === $to) {
            return $minor;
        }

        // round() first so float noise (100.0000000001) does not ceil to 101.
        return (int) ceil(round($minor * $this->factor($from, $to), 6));
    }

    /**
     * The `$from` amount a `$to` amount corresponds to at the shopper rate.
     * Used to test thresholds and filters written in another currency.
     */
    public function convertBack(int $minorInTo, string $from, string $to): int
    {
        if ($from === $to) {
            return $minorInTo;
        }

        return (int) floor(round($minorInTo / $this->factor($from, $to), 6));
    }

    /** Value at the mid-market rate, no markup (internal reporting only). */
    public function valueAtMidRate(int $minor, string $from, string $to): int
    {
        if ($from === $to) {
            return $minor;
        }

        $scale = 10 ** ($this->decimalPlaces($to) - $this->decimalPlaces($from));

        return (int) round($minor * $this->rate($from, $to)->midRate * $scale);
    }

    /** Minor-unit multiplier from `$from` to `$to`, markup and decimal places included. */
    public function factor(string $from, string $to): float
    {
        $scale = 10 ** ($this->decimalPlaces($to) - $this->decimalPlaces($from));

        return $this->rate($from, $to)->effectiveRate() * $scale;
    }

    public function decimalPlaces(string $code): int
    {
        $this->forgetOnNewRequest();
        $this->decimals ??= Currency::query()->pluck('decimal_places', 'code')->map(fn ($places): int => (int) $places)->all();

        if (! array_key_exists($code, $this->decimals)) {
            throw new RuntimeException("Currency {$code} is not configured in the currencies table.");
        }

        return $this->decimals[$code];
    }

    /** Start recording the rates handed out, for an order's FX snapshot. */
    public function trackUsage(): void
    {
        $this->used = [];
    }

    /**
     * @return list<ExchangeRate>
     */
    public function usedRates(): array
    {
        return array_values($this->used);
    }

    private function lookup(string $from, string $to): ExchangeRate
    {
        if ($from === $to) {
            return ExchangeRate::identity($from);
        }

        $this->forgetOnNewRequest();
        $this->rows ??= CurrencyConversion::query()->get()->keyBy(fn (CurrencyConversion $row): string => $row->from_currency_code.':'.$row->to_currency_code)->all();
        $row = $this->rows[$from.':'.$to] ?? null;

        if (! $row instanceof CurrencyConversion) {
            throw ExchangeRateUnavailable::for($from, $to, 'no rate stored');
        }

        $maxAgeHours = (int) config('currency.max_rate_age_hours');
        if ($row->fetched_at->lt(now()->subHours($maxAgeHours))) {
            throw ExchangeRateUnavailable::for($from, $to, "rate is from {$row->fetched_at->toIso8601String()}, older than {$maxAgeHours}h");
        }

        return new ExchangeRate(
            from: $from,
            to: $to,
            midRate: (float) $row->rate,
            markupPercent: $row->markup_percent !== null ? (float) $row->markup_percent : $this->defaultMarkup(),
            fetchedAt: $row->fetched_at,
            source: $row->source,
        );
    }

    private function forgetOnNewRequest(): void
    {
        $request = request();
        if ($this->loadedFor !== $request) {
            $this->loadedFor = $request;
            $this->decimals = $this->rows = $this->defaultMarkup = null;
        }
    }

    private function defaultMarkup(): float
    {
        return $this->defaultMarkup ??= $this->markup->defaultPercent();
    }
}
