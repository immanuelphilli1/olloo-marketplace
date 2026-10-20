<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\IdempotencyKey;
use Closure;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Makes a POST safe to retry. The client sends an `Idempotency-Key` header and
 * may reuse that one key freely on the same endpoint:
 *
 * - first request runs and, when it succeeds (2xx), its response is stored;
 * - a retry with the same key and the same request replays that stored
 *   response with `Idempotent-Replayed: true`;
 * - a retry while the first is still running gets 409 idempotency_in_progress;
 * - the same key on a different endpoint is a different key, so one key per
 *   checkout session works across POST /orders and POST /checkout/payment-intent;
 * - the same key with a different request after a success gets
 *   422 idempotency_key_reused, which catches accidental key reuse;
 * - any failed attempt (4xx or 5xx) frees the key, so a corrected request can
 *   be retried with the same key instead of replaying a stale error.
 *
 * The request hash ignores object key order and the order of scalar lists
 * (cart line rids are a set), so an unchanged request always hashes the same.
 */
final class EnforceIdempotencyKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user === null) {
            return $next($request);
        }

        $key = trim((string) $request->header('Idempotency-Key', ''));
        if ($key === '' || strlen($key) > 255) {
            return api_error(
                'idempotency_key_required',
                'Send an Idempotency-Key header (one key per checkout works; reuse it for retries of the same request).',
                428,
            );
        }

        $route = (string) ($request->route()?->getName() ?? $request->path());
        $hash = hash('sha256', $this->canonical($request->all()));

        try {
            $record = IdempotencyKey::query()->create([
                'user_id' => $user->id,
                'key' => $key,
                'route' => $route,
                'request_hash' => $hash,
            ]);
        } catch (UniqueConstraintViolationException) {
            return $this->replay($user->id, $key, $route, $hash);
        }

        $response = $next($request);

        // Only a success is worth replaying. A failed attempt left nothing
        // behind, so the key must not lock the client out of a corrected retry.
        if (! $response->isSuccessful()) {
            $record->delete();

            return $response;
        }

        $record->update([
            'response_status' => $response->getStatusCode(),
            'response_body' => (string) $response->getContent(),
            'completed_at' => now(),
        ]);

        return $response;
    }

    private function replay(int $userId, string $key, string $route, string $hash): Response
    {
        $existing = IdempotencyKey::query()
            ->where('user_id', $userId)
            ->where('key', $key)
            ->where('route', $route)
            ->first();

        if ($existing === null) {
            return api_error('idempotency_in_progress', 'A request with this Idempotency-Key is still being processed. Retry shortly.', 409);
        }

        if ($existing->request_hash !== $hash) {
            return api_error(
                'idempotency_key_reused',
                "This Idempotency-Key already completed {$existing->route} with a different request. Use a new key for a different request.",
                422,
                ['route' => $existing->route],
            );
        }

        if ($existing->completed_at === null) {
            return api_error('idempotency_in_progress', 'A request with this Idempotency-Key is still being processed. Retry shortly.', 409);
        }

        return response((string) $existing->response_body, (int) $existing->response_status)
            ->header('Content-Type', 'application/json')
            ->header('Idempotent-Replayed', 'true');
    }

    /**
     * Stable string for the request payload: object keys sorted, lists of
     * scalars sorted (line rids are a set), everything else untouched.
     */
    private function canonical(mixed $payload): string
    {
        if (! is_array($payload)) {
            return (string) json_encode($payload);
        }

        $isList = array_is_list($payload);
        $out = [];

        foreach ($payload as $key => $value) {
            $out[$key] = is_array($value) ? $this->canonical($value) : $value;
        }

        if ($isList && ! array_is_list($out)) {
            return (string) json_encode($out);
        }

        if ($isList && $out !== [] && ! is_array(reset($out))) {
            sort($out, SORT_STRING);
        } else {
            ksort($out, SORT_STRING);
        }

        return (string) json_encode($out);
    }
}
