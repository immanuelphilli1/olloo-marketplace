<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessPaymentWebhook;
use App\Models\PaymentWebhookEvent;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class WebhookEventController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('view_webhooks'), 403);

        $provider = trim((string) $request->query('provider', ''));
        $search = trim((string) $request->query('search', ''));
        $processed = $request->query('processed');

        $query = PaymentWebhookEvent::query()->latest('id');

        if ($provider !== '') {
            $query->where('provider', $provider);
        }

        if ($processed === '1') {
            $query->whereNotNull('processed_at');
        } elseif ($processed === '0') {
            $query->whereNull('processed_at');
        }

        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like, $search): void {
                $builder->where('external_event_id', 'like', $like)
                    ->orWhere('event_type', 'like', $like)
                    ->orWhere('rid', $search)
                    ->orWhere('payload', 'like', $like);
            });
        }

        $events = $query->paginate((int) config('admin.per_page'))->withQueryString()->through(fn (PaymentWebhookEvent $event) => [
            'rid' => $event->rid,
            'provider' => $event->provider,
            'externalEventId' => $event->external_event_id,
            'eventType' => $event->event_type,
            'processedAt' => $event->processed_at?->toIso8601String(),
            'createdAt' => $event->created_at?->toIso8601String(),
        ]);

        return Inertia::render('Admin/Webhooks/Index', [
            'events' => $events,
            'filters' => [
                'provider' => $provider,
                'search' => $search,
                'processed' => is_string($processed) ? $processed : '',
            ],
            'providers' => PaymentWebhookEvent::query()->distinct()->orderBy('provider')->pluck('provider')->values()->all(),
            'canReplay' => (bool) $request->user('staff')?->can('replay_webhooks'),
        ]);
    }

    public function show(Request $request, PaymentWebhookEvent $webhook): Response
    {
        abort_unless($request->user('staff')?->can('view_webhooks'), 403);

        return Inertia::render('Admin/Webhooks/Show', [
            'event' => [
                'rid' => $webhook->rid,
                'provider' => $webhook->provider,
                'externalEventId' => $webhook->external_event_id,
                'eventType' => $webhook->event_type,
                'payload' => $webhook->payload,
                'processedAt' => $webhook->processed_at?->toIso8601String(),
                'createdAt' => $webhook->created_at?->toIso8601String(),
            ],
            'canReplay' => (bool) $request->user('staff')?->can('replay_webhooks'),
        ]);
    }

    public function replay(Request $request, PaymentWebhookEvent $webhook): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('replay_webhooks'), 403);

        $webhook->forceFill(['processed_at' => null])->save();
        ProcessPaymentWebhook::dispatch($webhook->id);

        return back()->with('success', 'Webhook replay queued.');
    }
}
