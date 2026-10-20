<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\PaymentWebhookEvent;
use App\Services\PaymentSettlementService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ProcessPaymentWebhook implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    public int $timeout = 120;

    /** @var list<int> */
    public array $backoff = [15, 45, 90, 180, 300];

    public int $uniqueFor = 300;

    public function __construct(
        public readonly int $paymentWebhookEventId,
    ) {}

    public function uniqueId(): string
    {
        return (string) $this->paymentWebhookEventId;
    }

    public function handle(PaymentSettlementService $settlement): void
    {
        $event = PaymentWebhookEvent::query()->find($this->paymentWebhookEventId);
        if (! $event instanceof PaymentWebhookEvent) {
            return;
        }

        $settlement->processWebhookEvent($event);
    }
}
