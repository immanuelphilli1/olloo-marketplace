<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\PaymentProvider;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\PaymentWebhookEvent;
use App\Payments\PaymentGatewayManager;
use App\Services\PaymentSettlementService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class PaymentController extends Controller
{
    /**
     * Staff filter payments by when they happened, not by timestamp. `all` is
     * the default so money is never hidden behind a filter nobody set.
     *
     * @var array<string, string>
     */
    private const RANGES = [
        'today' => 'Today',
        '7d' => 'Last 7 days',
        '30d' => 'Last 30 days',
        'all' => 'All time',
    ];

    public function __construct(
        private readonly PaymentGatewayManager $gateways,
        private readonly PaymentSettlementService $settlement,
    ) {}

    public function index(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('view_payments'), 403);

        $status = trim((string) $request->query('status', ''));
        $status = in_array($status, PaymentStatus::values(), true) ? $status : '';

        $provider = trim((string) $request->query('provider', ''));
        $search = trim((string) $request->query('search', ''));
        $range = (string) $request->query('range', 'all');
        $range = array_key_exists($range, self::RANGES) ? $range : 'all';

        $payments = $this->scoped($status, $provider, $search, $range)
            ->with(['order:id,rid,order_reference,status', 'user:id,rid,name,email'])
            ->latest('id')
            ->paginate((int) config('admin.per_page'))
            ->withQueryString()
            ->through(fn (Payment $payment) => [
                'rid' => $payment->rid,
                'provider' => $payment->provider,
                'status' => $payment->status,
                'amount' => round($payment->amount_minor / 100, 2),
                'currencyCode' => $payment->currency_code,
                'externalReference' => $payment->external_reference,
                'createdAt' => $payment->created_at?->toIso8601String(),
                'order' => $payment->order ? [
                    'rid' => $payment->order->rid,
                    'reference' => $payment->order->order_reference,
                ] : null,
                'user' => $payment->user ? [
                    'rid' => $payment->user->rid,
                    'name' => $payment->user->name,
                    'email' => $payment->user->email,
                ] : null,
            ]);

        return Inertia::render('Admin/Payments/Index', [
            'payments' => $payments,
            'filters' => [
                'status' => $status,
                'provider' => $provider,
                'search' => $search,
                'range' => $range,
            ],
            'statuses' => PaymentStatus::values(),
            'providers' => Payment::query()->distinct()->orderBy('provider')->pluck('provider')->values()->all(),
            'ranges' => self::RANGES,
            'summary' => $this->summary($provider, $search, $range),
            'canViewOrders' => (bool) $request->user('staff')?->can('view_orders'),
        ]);
    }

    public function show(Request $request, Payment $payment): Response
    {
        abort_unless($request->user('staff')?->can('view_payments'), 403);

        $payment->load(['order:id,rid,order_reference,status,payment_status,total_minor,currency_code', 'user:id,rid,name,email', 'paymentMethod:id,rid,label,code']);
        $metadata = is_array($payment->metadata) ? $payment->metadata : [];
        $reference = $this->verifyReference($payment);

        return Inertia::render('Admin/Payments/Show', [
            'payment' => [
                'rid' => $payment->rid,
                'provider' => $payment->provider,
                'status' => $payment->status,
                'amount' => round($payment->amount_minor / 100, 2),
                'currencyCode' => $payment->currency_code,
                'externalReference' => $payment->external_reference,
                'checkoutUrl' => $payment->checkout_url,
                'createdAt' => $payment->created_at?->toIso8601String(),
                'updatedAt' => $payment->updated_at?->toIso8601String(),
                'method' => $payment->paymentMethod?->label,
                // Set when the provider confirmed a charge we could not accept.
                'reviewReason' => is_string($metadata['review_reason'] ?? null) ? $metadata['review_reason'] : null,
                'chargedAmount' => isset($metadata['charged_amount_minor']) && is_numeric($metadata['charged_amount_minor'])
                    ? round(((int) $metadata['charged_amount_minor']) / 100, 2)
                    : null,
                'chargedCurrency' => is_string($metadata['charged_currency'] ?? null) ? $metadata['charged_currency'] : null,
                'order' => $payment->order ? [
                    'rid' => $payment->order->rid,
                    'reference' => $payment->order->order_reference,
                    'status' => $payment->order->status,
                    'paymentStatus' => $payment->order->payment_status,
                    'total' => round($payment->order->total_minor / 100, 2),
                    'currencyCode' => $payment->order->currency_code,
                ] : null,
                'user' => $payment->user ? [
                    'rid' => $payment->user->rid,
                    'name' => $payment->user->name,
                    'email' => $payment->user->email,
                ] : null,
                'webhooks' => $this->webhookActivity($payment),
            ],
            'canRecheck' => (bool) $request->user('staff')?->can('recheck_payments'),
            'canViewOrders' => (bool) $request->user('staff')?->can('view_orders'),
            'canViewWebhooks' => (bool) $request->user('staff')?->can('view_webhooks'),
            'webhookSearch' => $reference,
        ]);
    }

    /**
     * Ask the payment company what really happened to this payment.
     *
     * This is the answer to "the customer says they paid": it re-verifies the
     * charge with the provider and runs it back through the same settlement
     * rules a webhook would, so an amount or currency mismatch still lands in
     * needs_review instead of quietly paying an order.
     */
    public function recheck(Request $request, Payment $payment): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('recheck_payments'), 403);

        if (! in_array($payment->status, [PaymentStatus::Pending->value, PaymentStatus::Failed->value], true)) {
            return back()->with('error', 'This payment is already settled, so there is nothing left to check.');
        }

        $company = PaymentProvider::tryFrom($payment->provider)?->label() ?? $payment->provider;

        try {
            $charge = $this->gateways->gateway($payment->provider)->verifyCharge($this->verifyReference($payment));
            $this->settlement->applyVerifiedCharge($payment, $charge);
        } catch (Throwable $e) {
            Log::warning('Staff payment recheck could not reach the provider', [
                'payment_rid' => $payment->rid,
                'provider' => $payment->provider,
                'message' => $e->getMessage(),
            ]);

            return back()->with('error', "We could not reach {$company} just now. Try again in a few minutes.");
        }

        $payment = $payment->fresh() ?? $payment;

        return back()->with('success', match ($payment->status) {
            PaymentStatus::Completed->value => "Checked with {$company}. The payment went through and the order is now marked paid.",
            PaymentStatus::NeedsReview->value => "Checked with {$company}. They confirmed a charge, but it is not what we expected, so this still needs your review.",
            PaymentStatus::Failed->value => "Checked with {$company}. They have no payment for this reference, so nothing was taken from the customer.",
            default => "Checked with {$company}. They have not confirmed a payment yet, so it is still waiting.",
        });
    }

    /**
     * The list query behind every filter, so the rows and the summary tiles
     * above them can never disagree about what is on screen.
     *
     * @return Builder<Payment>
     */
    private function scoped(string $status, string $provider, string $search, string $range): Builder
    {
        return Payment::query()
            ->when($status !== '', fn (Builder $query) => $query->where('status', $status))
            ->when($provider !== '', fn (Builder $query) => $query->where('provider', $provider))
            ->when($range !== 'all', fn (Builder $query) => $query->where('created_at', '>=', $this->rangeStart($range)))
            ->when($search !== '', function (Builder $query) use ($search): void {
                $like = '%'.$search.'%';

                $query->where(function (Builder $query) use ($like, $search): void {
                    $query->where('rid', $search)
                        ->orWhere('external_reference', 'like', $like)
                        ->orWhereHas('order', fn (Builder $query) => $query->where('order_reference', 'like', $like))
                        ->orWhereHas('user', fn (Builder $query) => $query
                            ->where('name', 'like', $like)
                            ->orWhere('email', 'like', $like));
                });
            });
    }

    /**
     * Counts and money per status for the tiles, ignoring the status filter so
     * every tile stays a reachable shortcut. Totals are grouped by currency
     * because adding Dirhams to Cedi is not a number anyone should read.
     *
     * @return list<array{status: string, count: int, totals: list<array{currency: string, amount: float}>}>
     */
    private function summary(string $provider, string $search, string $range): array
    {
        $rows = $this->scoped('', $provider, $search, $range)
            ->selectRaw('status, currency_code, COUNT(*) AS aggregate, COALESCE(SUM(amount_minor), 0) AS total_minor')
            ->groupBy('status', 'currency_code')
            ->get();

        $statusOrder = array_flip(PaymentStatus::values());

        return $rows
            ->groupBy('status')
            ->map(fn ($group, string $status) => [
                'status' => $status,
                'count' => (int) $group->sum('aggregate'),
                'totals' => $group->map(fn ($row) => [
                    'currency' => (string) $row->currency_code,
                    'amount' => round(((int) $row->total_minor) / 100, 2),
                ])->values()->all(),
            ])
            ->sortBy(fn (array $row) => $statusOrder[$row['status']] ?? count($statusOrder))
            ->values()
            ->all();
    }

    private function rangeStart(string $range): Carbon
    {
        return match ($range) {
            'today' => now()->startOfDay(),
            '7d' => now()->subDays(6)->startOfDay(),
            '30d' => now()->subDays(29)->startOfDay(),
            default => now()->subDays(29)->startOfDay(),
        };
    }

    /**
     * The provider only knows its own reference, so fall back to ours when the
     * charge never got one (the shopper abandoned checkout).
     */
    private function verifyReference(Payment $payment): string
    {
        return is_string($payment->external_reference) && $payment->external_reference !== ''
            ? $payment->external_reference
            : (string) $payment->rid;
    }

    /**
     * How much the payment company last told us about this payment. Webhook
     * rows carry no payment id, so they are matched on the reference.
     *
     * @return array{count: int, lastReceivedAt: string|null, lastEventType: string|null}
     */
    private function webhookActivity(Payment $payment): array
    {
        $events = PaymentWebhookEvent::query()
            ->where('provider', $payment->provider)
            ->where(function ($query) use ($payment): void {
                $query->where('external_event_id', 'like', '%'.$payment->rid.'%')
                    ->orWhere('payload', 'like', '%'.$payment->rid.'%');

                if (is_string($payment->external_reference) && $payment->external_reference !== '') {
                    $query->orWhere('payload', 'like', '%'.$payment->external_reference.'%');
                }
            })
            ->orderByDesc('id')
            ->limit(25)
            ->get(['event_type', 'created_at']);

        $latest = $events->first();

        return [
            'count' => $events->count(),
            'lastReceivedAt' => $latest?->created_at?->toIso8601String(),
            'lastEventType' => $latest?->event_type,
        ];
    }
}
