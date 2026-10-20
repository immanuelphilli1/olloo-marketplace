<?php

declare(strict_types=1);

namespace App\Payments\Concerns;

use App\Models\Payment;
use App\Services\ExternalRequestLogger;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Logged JSON requests for REST gateways. Every outbound call (success and
 * failure) lands in Request History; connection failures throw loudly.
 */
trait LogsProviderRequests
{
    // Users define: public function __construct(private readonly ExternalRequestLogger $requestLogger) {}

    /**
     * @param  array<string, mixed>  $headers
     * @param  array<string, mixed>|null  $body
     * @param  string|null  $envelopeSuccessKey  body key that must be `true` for the
     *                                           call to have succeeded, for providers
     *                                           that answer 200 with a rejection
     */
    private function loggedRequest(
        string $service,
        string $method,
        string $url,
        array $headers,
        ?array $body,
        string $action,
        ?string $paymentKey = null,
        bool $asForm = false,
        ?string $envelopeSuccessKey = null,
    ): Response {
        $started = microtime(true);

        try {
            $pending = Http::withHeaders($headers)->acceptJson()->timeout(30);
            if ($asForm) {
                $pending->asForm();
            }

            $response = $method === 'GET'
                ? $pending->get($url)
                : $pending->post($url, $body ?? []);

            $this->requestLogger->logOutgoing([
                'service' => $service,
                'action' => $action,
                'request' => ['method' => $method, 'url' => $url, 'headers' => $this->redactedHeaders($headers), 'body' => $body],
                'response' => [
                    'status_code' => $response->status(),
                    'headers' => $response->headers(),
                    'body' => $response->body(),
                    'success' => $this->callSucceeded($response, $envelopeSuccessKey),
                ],
                'duration_ms' => (int) round((microtime(true) - $started) * 1000),
                'entities' => $this->paymentEntities($paymentKey),
            ]);

            return $response;
        } catch (ConnectionException $e) {
            $this->requestLogger->logOutgoing([
                'service' => $service,
                'action' => $action,
                'request' => ['method' => $method, 'url' => $url, 'headers' => $this->redactedHeaders($headers), 'body' => $body],
                'response' => ['status_code' => null, 'success' => false, 'body' => null],
                'duration_ms' => (int) round((microtime(true) - $started) * 1000),
                'exception' => $e,
                'entities' => $this->paymentEntities($paymentKey),
            ]);

            Log::warning($service.' HTTP connection failed', ['action' => $action, 'url' => $url]);

            throw new RuntimeException(ucfirst($service).' request failed: '.$e->getMessage(), 0, $e);
        }
    }

    /**
     * Whether the call actually did what we asked. Some providers answer HTTP
     * 200 and then refuse the charge in the body ("No active channel to process
     * transaction"), so transport status alone would file a rejection under
     * success and hide it from anyone filtering Request History by failure.
     */
    private function callSucceeded(Response $response, ?string $envelopeSuccessKey): bool
    {
        if (! $response->successful()) {
            return false;
        }

        if ($envelopeSuccessKey === null) {
            return true;
        }

        return $response->json($envelopeSuccessKey) === true;
    }

    /**
     * @param  array<string, mixed>  $headers
     * @return array<string, mixed>
     */
    private function redactedHeaders(array $headers): array
    {
        foreach (['Authorization', 'authorization'] as $key) {
            if (isset($headers[$key])) {
                $headers[$key] = '***redacted***';
            }
        }

        return $headers;
    }

    /**
     * @return list<array{type: class-string, id: int|null, rid: string|null}>
     */
    private function paymentEntities(?string $paymentKey): array
    {
        if ($paymentKey === null || trim($paymentKey) === '') {
            return [];
        }

        $key = trim($paymentKey);
        $payment = Payment::query()
            ->where('rid', $key)
            ->orWhere('external_reference', $key)
            ->first();

        return [[
            'type' => Payment::class,
            'id' => $payment?->id,
            'rid' => $payment?->rid ?? $key,
        ]];
    }
}
