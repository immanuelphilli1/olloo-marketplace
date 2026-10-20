<?php

declare(strict_types=1);

namespace App\Currency;

use App\Services\ExternalRequestLogger;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Visitor IP to ISO country code via ipinfo Lite. The answer is cached per IP
 * (a country belongs to the IP, not the user), misses are cached too so an
 * unplaceable IP does not cost a call per request, and a provider error pauses
 * all lookups for a few minutes instead of hammering a struggling API.
 */
final class GeoIpCountry
{
    private const BACKOFF_KEY = 'geoip.backoff';

    public function __construct(
        private readonly ExternalRequestLogger $requestLogger,
    ) {}

    public function countryCodeFor(?string $ip): ?string
    {
        if ($ip === null || filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            return null;
        }

        $token = config('services.ipinfo.token');
        if (! is_string($token) || $token === '') {
            return null;
        }

        // '' marks a cached miss: Cache::get() cannot tell a stored null from no entry.
        $cached = Cache::get($this->cacheKey($ip));
        if (is_string($cached)) {
            return $cached === '' ? null : $cached;
        }

        if (Cache::has(self::BACKOFF_KEY)) {
            return null;
        }

        return $this->lookup($ip, $token);
    }

    private function lookup(string $ip, string $token): ?string
    {
        $url = rtrim((string) config('services.ipinfo.base_url'), '/').'/'.$ip;
        $start = hrtime(true);
        $response = null;
        $exception = null;

        try {
            $response = Http::timeout((int) config('currency.geoip.timeout_seconds'))
                ->withToken($token)
                ->acceptJson()
                ->get($url);
        } catch (Throwable $e) {
            $exception = $e;
        } finally {
            $this->requestLogger->logOutgoing([
                'service' => 'ipinfo',
                'action' => 'country_lookup',
                // The token travels as a bearer header, kept out of the log.
                'request' => ['method' => 'GET', 'url' => $url, 'headers' => []],
                'response' => $response instanceof Response ? [
                    'status_code' => $response->status(),
                    'body' => $response->body(),
                    'success' => $response->successful(),
                ] : null,
                'exception' => $exception,
                'duration_ms' => (int) ((hrtime(true) - $start) / 1_000_000),
                'meta' => ['ip' => $ip],
            ]);
        }

        if (! $response instanceof Response || ! $response->successful()) {
            Cache::put(self::BACKOFF_KEY, true, now()->addMinutes((int) config('currency.geoip.backoff_minutes')));

            return null;
        }

        $code = $response->json('country_code');
        $code = is_string($code) && preg_match('/^[A-Za-z]{2}$/', $code) === 1 ? strtoupper($code) : null;

        Cache::put(
            $this->cacheKey($ip),
            $code ?? '',
            $code !== null
                ? now()->addHours((int) config('currency.geoip.hit_ttl_hours'))
                : now()->addMinutes((int) config('currency.geoip.miss_ttl_minutes')),
        );

        return $code;
    }

    private function cacheKey(string $ip): string
    {
        return 'geoip.country.'.$ip;
    }
}
