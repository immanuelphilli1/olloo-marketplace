<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Country;
use App\Services\ExternalRequestLogger;
use Illuminate\Console\Command;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/**
 * Creates and updates `countries` from RestCountries v5, keyed by ISO alpha-2
 * code. Never deletes: addresses reference countries by id.
 */
final class SyncCountries extends Command
{
    private const RESPONSE_FIELDS = 'names.common,codes.alpha_2,codes.alpha_3,flag.emoji,calling_codes,currencies,region';

    private const PAGE_SIZE = 100;

    protected $signature = 'countries:sync';

    protected $description = 'Sync the countries table from the RestCountries API (v5)';

    public function __construct(
        private readonly ExternalRequestLogger $requestLogger,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $apiKey = config('services.restcountries.api_key');

        if (! is_string($apiKey) || trim($apiKey) === '') {
            $this->error('RESTCOUNTRIES_API_KEY is not configured. Get a key at https://restcountries.com/sign-up.');

            return self::FAILURE;
        }

        $this->info('Fetching countries from RestCountries...');

        try {
            $countries = $this->fetchAllCountries($apiKey);
            [$created, $updated] = $this->upsert($countries);
        } catch (Throwable $e) {
            $this->error('Country sync failed: '.$e->getMessage());
            Log::error('countries:sync failed', ['error' => $e->getMessage()]);

            return self::FAILURE;
        }

        $this->info("Countries synced. Created: {$created}, updated: {$updated}.");
        Log::info('countries:sync completed', ['created' => $created, 'updated' => $updated]);

        return self::SUCCESS;
    }

    /**
     * @param  list<array<string, mixed>>  $countries
     * @return array{0: int, 1: int}
     */
    private function upsert(array $countries): array
    {
        $created = 0;
        $updated = 0;

        foreach ($countries as $data) {
            $code = strtoupper((string) $this->field($data, 'codes.alpha_2'));
            $name = $this->field($data, 'names.common');

            if (strlen($code) !== 2 || ! is_string($name) || trim($name) === '') {
                continue;
            }

            $payload = [
                'name' => trim($name),
                'alpha3' => $this->upperOrNull($this->field($data, 'codes.alpha_3'), 3),
                'region' => $this->stringOrNull($this->field($data, 'region')),
                'phone_code' => $this->primaryCallingCode($data),
                'currency_code' => $this->primaryCurrencyCode($data),
                'flag' => $this->stringOrNull($this->field($data, 'flag.emoji')),
                'synced_at' => now(),
            ];

            $country = Country::query()->where('code', $code)->first();

            if ($country instanceof Country) {
                // Keep a calling code we already have when the API has none.
                $payload['phone_code'] ??= $country->phone_code;
                $country->update($payload);
                $updated++;
            } else {
                Country::query()->create(['code' => $code, ...$payload]);
                $created++;
            }
        }

        return [$created, $updated];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function fetchAllCountries(string $apiKey): array
    {
        $baseUrl = rtrim((string) config('services.restcountries.base_url'), '/');
        $countries = [];
        $offset = 0;

        do {
            $query = [
                'response_fields' => self::RESPONSE_FIELDS,
                'limit' => self::PAGE_SIZE,
                'offset' => $offset,
            ];
            $started = microtime(true);
            $response = null;
            $exception = null;

            try {
                $response = Http::withToken($apiKey)->acceptJson()->timeout(15)->get($baseUrl, $query);
            } catch (Throwable $e) {
                $exception = $e;

                throw $e;
            } finally {
                $this->logRequest($baseUrl, $query, $response, $exception, $started);
            }

            if (! $response->successful()) {
                throw new RuntimeException("RestCountries request failed ({$response->status()}): ".mb_substr($response->body(), 0, 300));
            }

            $payload = $response->json();
            if (! is_array($payload)) {
                throw new RuntimeException('RestCountries returned invalid JSON.');
            }

            if (! empty($payload['errors']) && is_array($payload['errors'])) {
                throw new RuntimeException('RestCountries API error: '.($payload['errors'][0]['message'] ?? json_encode($payload['errors'])));
            }

            $data = $payload['data'] ?? null;
            if (! is_array($data) || ! is_array($data['objects'] ?? null)) {
                throw new RuntimeException('RestCountries response is missing data.objects.');
            }

            if (isset($data['_demo'])) {
                throw new RuntimeException('The RestCountries demo key cannot sync countries. Set RESTCOUNTRIES_API_KEY to a real key.');
            }

            array_push($countries, ...$data['objects']);

            $more = (bool) ($data['meta']['more'] ?? false);
            $offset += self::PAGE_SIZE;
        } while ($more);

        if ($countries === []) {
            throw new RuntimeException('RestCountries returned no countries.');
        }

        return $countries;
    }

    /**
     * @param  array<string, mixed>  $query
     */
    private function logRequest(string $url, array $query, ?Response $response, ?Throwable $exception, float $started): void
    {
        $this->requestLogger->logOutgoing([
            'service' => 'restcountries',
            'action' => 'sync_countries',
            'request' => [
                'method' => 'GET',
                'url' => $url.'?'.http_build_query($query),
                'headers' => ['Authorization' => ['Bearer ***redacted***']],
                'body' => null,
            ],
            'response' => $response ? [
                'status_code' => $response->status(),
                'body' => $response->body(),
                'success' => $response->successful(),
            ] : null,
            'exception' => $exception,
            'duration_ms' => (int) round((microtime(true) - $started) * 1000),
            'meta' => ['offset' => $query['offset'], 'limit' => $query['limit']],
        ]);
    }

    /**
     * @param  array<string, mixed>  $country
     */
    private function field(array $country, string $path): mixed
    {
        if (array_key_exists($path, $country)) {
            return $country[$path];
        }

        $value = $country;
        foreach (explode('.', $path) as $segment) {
            if (! is_array($value) || ! array_key_exists($segment, $value)) {
                return null;
            }
            $value = $value[$segment];
        }

        return $value;
    }

    private function stringOrNull(mixed $value): ?string
    {
        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }

    private function upperOrNull(mixed $value, int $length): ?string
    {
        $value = $this->stringOrNull($value);

        return $value !== null && strlen($value) === $length ? strtoupper($value) : null;
    }

    /**
     * @param  array<string, mixed>  $country
     */
    private function primaryCallingCode(array $country): ?string
    {
        $codes = $this->field($country, 'calling_codes');
        if (! is_array($codes)) {
            return null;
        }

        foreach ($codes as $code) {
            if (is_scalar($code) && (string) $code !== '') {
                $code = (string) $code;

                return str_starts_with($code, '+') ? $code : '+'.$code;
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $country
     */
    private function primaryCurrencyCode(array $country): ?string
    {
        $currencies = $this->field($country, 'currencies');
        if (! is_array($currencies) || $currencies === []) {
            return null;
        }

        $code = isset($currencies[0]) && is_array($currencies[0])
            ? ($currencies[0]['code'] ?? null)
            : array_key_first($currencies);

        return $this->upperOrNull($code, 3);
    }
}
