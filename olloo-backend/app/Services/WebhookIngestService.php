<?php

declare(strict_types=1);

namespace App\Services;

use App\Jobs\ProcessPaymentWebhook;
use App\Models\Payment;
use App\Models\PaymentWebhookEvent;
use App\Payments\PaymentGatewayManager;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

final class WebhookIngestService
{
    public function __construct(
        private readonly PaymentGatewayManager $gateways,
        private readonly ExternalRequestLogger $requestLogger,
    ) {}

    /**
     * Parse a provider webhook, persist idempotently, and queue settlement.
     */
    public function ingest(string $provider, Request $request): PaymentWebhookEvent
    {
        $started = microtime(true);
        $exception = null;
        $row = null;

        try {
            $event = $this->gateways->gateway($provider)->parseWebhook($request);

            try {
                $row = PaymentWebhookEvent::query()->create([
                    'provider' => $event->provider,
                    'external_event_id' => $event->externalEventId,
                    'event_type' => $event->eventType,
                    'payload' => [
                        'reference' => $event->reference,
                        'paid' => $event->paid,
                        'event_type' => $event->eventType,
                        'raw' => $event->payload,
                    ],
                ]);

                ProcessPaymentWebhook::dispatch($row->id);
            } catch (QueryException $e) {
                $existing = PaymentWebhookEvent::query()
                    ->where('provider', $event->provider)
                    ->where('external_event_id', $event->externalEventId)
                    ->first();

                if ($existing instanceof PaymentWebhookEvent) {
                    Log::info('Duplicate payment webhook ignored', [
                        'provider' => $event->provider,
                        'external_event_id' => $event->externalEventId,
                    ]);

                    $row = $existing;
                } else {
                    throw $e;
                }
            }

            return $row;
        } catch (Throwable $e) {
            $exception = $e;
            throw $e;
        } finally {
            $durationMs = (int) round((microtime(true) - $started) * 1000);
            $entities = [];
            if ($row instanceof PaymentWebhookEvent) {
                $entities[] = [
                    'type' => PaymentWebhookEvent::class,
                    'id' => $row->id,
                    'rid' => $row->rid,
                ];

                $reference = is_array($row->payload) ? ($row->payload['reference'] ?? null) : null;
                if (is_string($reference) && $reference !== '') {
                    $payment = Payment::query()
                        ->where('rid', $reference)
                        ->orWhere('external_reference', $reference)
                        ->first();

                    if ($payment instanceof Payment) {
                        $entities[] = [
                            'type' => Payment::class,
                            'id' => $payment->id,
                            'rid' => $payment->rid,
                        ];
                    }
                }
            }

            $this->requestLogger->fromHttp(
                service: 'payment_webhook',
                direction: 'incoming',
                request: $request,
                response: $exception === null ? [
                    'status_code' => 200,
                    'success' => true,
                    'body' => [
                        'provider' => $row?->provider,
                        'external_event_id' => $row?->external_event_id,
                        'rid' => $row?->rid,
                    ],
                ] : [
                    'status_code' => 400,
                    'success' => false,
                ],
                exception: $exception,
                durationMs: $durationMs,
                entities: $entities,
                meta: ['provider' => $provider],
                action: 'ingest',
            );
        }
    }
}
