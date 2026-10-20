<?php

declare(strict_types=1);

namespace App\Currency;

use App\Models\Currency;
use App\Models\CurrencyConversion;
use App\Services\ExternalRequestLogger;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Throwable;

/**
 * Fetches mid-market rates from exchangerate-api.com against the default
 * currency and stores every ordered pair of configured currencies (cross
 * rates go through the default). Staff markup overrides on existing pairs are
 * kept. Without EXCHANGE_RATE_API_KEY the keyless open.er-api.com endpoint of
 * the same provider is used.
 */
final class ExchangeRateUpdater
{
    public function __construct(
        private readonly ExternalRequestLogger $requestLogger,
    ) {}

    /**
     * @return array{base: string, source: string, pairs: int, missing: list<string>}
     *
     * @throws RuntimeException when the provider call fails
     */
    public function update(): array
    {
        $base = Currency::defaultCode();
        $codes = Currency::query()->orderBy('code')->pluck('code')->all();

        [$rates, $source] = $this->fetch($base);
        $rates[$base] = 1.0;

        $missing = array_values(array_diff($codes, array_keys($rates)));
        $known = array_values(array_intersect($codes, array_keys($rates)));
        $fetchedAt = now();
        $pairs = 0;

        foreach ($known as $from) {
            foreach ($known as $to) {
                if ($from === $to) {
                    continue;
                }

                CurrencyConversion::query()->updateOrCreate(
                    ['from_currency_code' => $from, 'to_currency_code' => $to],
                    ['rate' => $rates[$to] / $rates[$from], 'fetched_at' => $fetchedAt, 'source' => $source],
                );
                $pairs++;
            }
        }

        return ['base' => $base, 'source' => $source, 'pairs' => $pairs, 'missing' => $missing];
    }

    /**
     * @return array{0: array<string, float>, 1: string} rates per code against `$base`, and the source name
     */
    private function fetch(string $base): array
    {
        $key = config('services.exchange_rate.api_key');
        [$url, $loggedUrl, $source] = is_string($key) && $key !== ''
            ? ["https://v6.exchangerate-api.com/v6/{$key}/latest/{$base}", "https://v6.exchangerate-api.com/v6/***/latest/{$base}", 'exchangerate-api']
            : ["https://open.er-api.com/v6/latest/{$base}", "https://open.er-api.com/v6/latest/{$base}", 'open-er-api'];

        $start = hrtime(true);
        $response = null;
        $exception = null;

        try {
            $response = Http::timeout(30)->acceptJson()->get($url);
        } catch (Throwable $e) {
            $exception = $e;
        } finally {
            $this->requestLogger->logOutgoing([
                'service' => $source,
                'action' => 'fetch_rates',
                'request' => ['method' => 'GET', 'url' => $loggedUrl, 'headers' => [], 'body' => ['base' => $base]],
                'response' => $response instanceof Response ? [
                    'status_code' => $response->status(),
                    'body' => $response->body(),
                    // HTTP 200 can still carry "result": "error".
                    'success' => $response->successful() && $response->json('result') === 'success',
                ] : null,
                'exception' => $exception,
                'duration_ms' => (int) ((hrtime(true) - $start) / 1_000_000),
            ]);
        }

        if ($exception !== null) {
            throw new RuntimeException("Exchange rate request failed: {$exception->getMessage()}", previous: $exception);
        }

        if (! $response instanceof Response || ! $response->successful() || $response->json('result') !== 'success') {
            $reason = $response?->json('error-type') ?? 'HTTP '.$response?->status();
            throw new RuntimeException("Exchange rate provider refused the request ({$reason}).");
        }

        // The keyed v6 API names the map conversion_rates; the open endpoint calls it rates.
        $raw = $response->json('conversion_rates') ?? $response->json('rates');
        if (! is_array($raw)) {
            throw new RuntimeException('Exchange rate response has no rates.');
        }

        $rates = [];
        foreach ($raw as $code => $rate) {
            if (is_string($code) && is_numeric($rate) && (float) $rate > 0) {
                $rates[strtoupper($code)] = (float) $rate;
            }
        }

        return [$rates, $source];
    }
}
