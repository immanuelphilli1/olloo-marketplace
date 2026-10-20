<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\WebhookIngestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
use Throwable;

final class WebhookController extends Controller
{
    public function __construct(
        private readonly WebhookIngestService $webhooks,
    ) {}

    public function __invoke(Request $request, string $provider): JsonResponse
    {
        $provider = strtolower(trim($provider));

        if ($provider === '') {
            return api_error('invalid_provider', 'Payment provider is required.', 422);
        }

        try {
            $event = $this->webhooks->ingest($provider, $request);
        } catch (InvalidArgumentException $e) {
            return api_error('invalid_provider', $e->getMessage(), 422);
        } catch (Throwable $e) {
            report($e);

            return api_error('webhook_ingest_failed', 'Unable to ingest webhook.', 400);
        }

        return response()->json([
            'received' => true,
            'provider' => $event->provider,
            'externalEventId' => $event->external_event_id,
        ]);
    }
}
