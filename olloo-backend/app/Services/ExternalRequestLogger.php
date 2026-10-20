<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\ExternalRequestLog;
use App\Models\ExternalRequestLogEntity;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;

final class ExternalRequestLogger
{
    /**
     * @param  array{
     *     service: string,
     *     action?: string|null,
     *     request?: array{method?: string|null, url?: string|null, headers?: array<string, mixed>, body?: mixed},
     *     response?: array{status_code?: int|null, headers?: array<string, mixed>, body?: mixed, success?: bool}|null,
     *     direction?: string,
     *     user?: Authenticatable|null,
     *     guard?: string|null,
     *     entities?: list<array{type: class-string|string, id?: int|null, rid?: string|null}>,
     *     meta?: array<string, mixed>,
     *     exception?: \Throwable|null,
     *     duration_ms?: int|null
     * }  $data
     */
    public function logOutgoing(array $data): ExternalRequestLog
    {
        $data['direction'] = $data['direction'] ?? 'outgoing';

        return $this->store($data);
    }

    /**
     * @param  array{
     *     service: string,
     *     action?: string|null,
     *     request?: array{method?: string|null, url?: string|null, headers?: array<string, mixed>, body?: mixed},
     *     response?: array{status_code?: int|null, headers?: array<string, mixed>, body?: mixed, success?: bool}|null,
     *     direction?: string,
     *     user?: Authenticatable|null,
     *     guard?: string|null,
     *     entities?: list<array{type: class-string|string, id?: int|null, rid?: string|null}>,
     *     meta?: array<string, mixed>,
     *     exception?: \Throwable|null,
     *     duration_ms?: int|null
     * }  $data
     */
    public function logIncoming(array $data): ExternalRequestLog
    {
        $data['direction'] = $data['direction'] ?? 'incoming';

        return $this->store($data);
    }

    /**
     * @param  array{status_code?: int|null, headers?: array<string, mixed>, body?: mixed, success?: bool}|null  $response
     * @param  list<array{type: class-string|string, id?: int|null, rid?: string|null}>  $entities
     * @param  array<string, mixed>  $meta
     */
    public function fromHttp(
        string $service,
        string $direction,
        Request $request,
        ?array $response = null,
        ?\Throwable $exception = null,
        ?int $durationMs = null,
        array $entities = [],
        array $meta = [],
        ?string $action = null,
    ): ExternalRequestLog {
        return $this->store([
            'service' => $service,
            'action' => $action,
            'direction' => $direction,
            'request' => [
                'method' => $request->method(),
                'url' => $request->fullUrl(),
                'headers' => $request->headers->all(),
                'body' => $request->getContent(),
            ],
            'response' => $response,
            'exception' => $exception,
            'duration_ms' => $durationMs,
            'entities' => $entities,
            'meta' => $meta,
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function store(array $data): ExternalRequestLog
    {
        $service = (string) ($data['service'] ?? '');
        $direction = (string) ($data['direction'] ?? 'outgoing');
        $action = isset($data['action']) && is_string($data['action'])
            ? $data['action']
            : ($data['meta']['action'] ?? null);
        if (is_string($action) && strlen($action) > 64) {
            $action = substr($action, 0, 64);
        }

        $request = (array) ($data['request'] ?? []);
        $response = (array) ($data['response'] ?? []);
        $exception = $data['exception'] ?? null;
        $durationMs = $data['duration_ms'] ?? null;
        $entities = (array) ($data['entities'] ?? []);
        $meta = (array) ($data['meta'] ?? []);

        $user = $data['user'] ?? $this->resolveUser();
        $guard = $data['guard'] ?? $this->resolveGuard($user instanceof Authenticatable ? $user : null);

        $requestHeaders = $this->maskHeaders((array) ($request['headers'] ?? []));
        $requestBody = $this->maskBody($request['body'] ?? null);
        $responseHeaders = $this->maskHeaders((array) ($response['headers'] ?? []));
        $responseBody = $this->maskBody($response['body'] ?? null);

        if ($exception instanceof \Throwable) {
            $meta['has_exception'] = true;
        }

        $statusCode = isset($response['status_code']) ? (int) $response['status_code'] : null;
        $success = array_key_exists('success', $response)
            ? (bool) $response['success']
            : ($statusCode !== null && $statusCode >= 200 && $statusCode < 300);

        $log = ExternalRequestLog::query()->create([
            'direction' => $direction,
            'service' => $service,
            'action' => is_string($action) ? $action : null,
            'request_method' => $request['method'] ?? null,
            'request_url' => $request['url'] ?? null,
            'status_code' => $statusCode,
            'success' => $success,
            'duration_ms' => $durationMs,
            'request_headers' => $requestHeaders !== [] ? json_encode($requestHeaders) : null,
            'request_body' => $requestBody,
            'response_headers' => $responseHeaders !== [] ? json_encode($responseHeaders) : null,
            'response_body' => $responseBody,
            'exception_class' => $exception instanceof \Throwable ? $exception::class : null,
            'exception_message' => $exception instanceof \Throwable ? $exception->getMessage() : null,
            'user_id' => $user instanceof Authenticatable ? $user->getAuthIdentifier() : null,
            'guard' => $guard,
            'meta' => $meta !== [] ? $meta : null,
        ]);

        $this->attachEntities($log, $entities);

        return $log;
    }

    private function resolveUser(): ?Authenticatable
    {
        foreach (['staff', 'web', null] as $guard) {
            $user = $guard ? Auth::guard($guard)->user() : Auth::user();
            if ($user instanceof Authenticatable) {
                return $user;
            }
        }

        return null;
    }

    private function resolveGuard(?Authenticatable $user): ?string
    {
        if ($user === null) {
            return PHP_SAPI === 'cli' ? 'cli' : 'system';
        }

        foreach (['staff', 'web'] as $guard) {
            if (Auth::guard($guard)->check() && Auth::guard($guard)->id() === $user->getAuthIdentifier()) {
                return $guard;
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $headers
     * @return array<string, mixed>
     */
    private function maskHeaders(array $headers): array
    {
        $sensitive = [
            'authorization',
            'x-api-key',
            'api-key',
            'x-paystack-signature',
            'stripe-signature',
            'cookie',
            'set-cookie',
        ];

        $normalized = [];

        foreach ($headers as $name => $value) {
            $lower = strtolower((string) $name);
            if (in_array($lower, $sensitive, true)) {
                $normalized[$name] = ['***redacted***'];
            } else {
                $normalized[$name] = (array) $value;
            }
        }

        return $normalized;
    }

    private function maskBody(mixed $body): ?string
    {
        if ($body === null || $body === '') {
            return null;
        }

        $stringBody = is_string($body) ? $body : json_encode($body);
        if ($stringBody === false) {
            return null;
        }

        $decoded = json_decode($stringBody, true);
        if (is_array($decoded)) {
            $json = json_encode($this->maskSensitiveArray($decoded));
            if ($json !== false) {
                $stringBody = $json;
            }
        }

        $max = 8000;
        if (strlen($stringBody) > $max) {
            $stringBody = substr($stringBody, 0, $max).'... [truncated]';
        }

        return $stringBody;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function maskSensitiveArray(array $data): array
    {
        $sensitiveKeys = [
            'password',
            'password_confirmation',
            'token',
            'access_token',
            'refresh_token',
            'secret',
            'client_secret',
            'card_number',
            'card_cvv',
        ];

        $result = [];

        foreach ($data as $key => $value) {
            if (in_array((string) $key, $sensitiveKeys, true)) {
                $result[$key] = '***redacted***';

                continue;
            }

            $result[$key] = is_array($value) ? $this->maskSensitiveArray($value) : $value;
        }

        return $result;
    }

    /**
     * @param  list<array{type?: string, id?: int|null, rid?: string|null}>  $entities
     */
    private function attachEntities(ExternalRequestLog $log, array $entities): void
    {
        if ($entities === []) {
            return;
        }

        $rows = [];

        foreach ($entities as $entity) {
            $type = Arr::get($entity, 'type');
            if (! is_string($type) || $type === '') {
                continue;
            }

            $rows[] = [
                'external_request_log_id' => $log->id,
                'entity_type' => $type,
                'entity_id' => Arr::get($entity, 'id'),
                'entity_rid' => Arr::get($entity, 'rid'),
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        if ($rows !== []) {
            ExternalRequestLogEntity::query()->insert($rows);
        }
    }
}
