<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Payment;
use App\Payments\Gateways\PaypalGateway;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Capture a buyer-approved PayPal order. Approval moves no money; this does.
 * Idempotent via PayPal-Request-Id (our payment rid).
 */
class CapturePaypalOrder implements ShouldBeUnique, ShouldQueue
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
        return 'capture-paypal-'.$this->paymentId;
    }

    public function handle(): void
    {
        $payment = Payment::query()->find($this->paymentId);
        if (! $payment instanceof Payment
            || $payment->provider !== 'paypal'
            || in_array($payment->status, ['completed', 'needs_review', 'refunded'], true)
            || ! is_string($payment->external_reference)
            || $payment->external_reference === '') {
            return;
        }

        app(PaypalGateway::class)->captureOrder($payment->external_reference, $payment->rid);
    }
}
