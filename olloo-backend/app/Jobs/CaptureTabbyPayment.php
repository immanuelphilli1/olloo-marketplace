<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Payment;
use App\Payments\Gateways\TabbyGateway;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Collect an authorised Tabby payment in full. Tabby only releases funds on
 * capture; authorised means the money is guaranteed, closed means done.
 */
class CaptureTabbyPayment implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    public int $timeout = 120;

    /** @var list<int> */
    public array $backoff = [15, 45, 90, 180, 300];

    public int $uniqueFor = 300;

    public function __construct(
        public readonly int $paymentId,
    ) {}

    public function uniqueId(): string
    {
        return 'capture-tabby-'.$this->paymentId;
    }

    public function handle(): void
    {
        $payment = Payment::query()->find($this->paymentId);
        if (! $payment instanceof Payment
            || $payment->provider !== 'tabby'
            || ! is_string($payment->external_reference)
            || $payment->external_reference === '') {
            return;
        }

        app(TabbyGateway::class)->captureFull(
            $payment->external_reference,
            (int) $payment->amount_minor,
            $payment->rid,
        );
    }
}
