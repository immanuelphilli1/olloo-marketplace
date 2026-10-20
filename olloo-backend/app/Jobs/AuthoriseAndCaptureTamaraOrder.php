<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Payment;
use App\Payments\Gateways\TamaraGateway;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Move an approved Tamara order to captured: authorise it, then capture the
 * full amount. Already-captured orders are left alone.
 */
class AuthoriseAndCaptureTamaraOrder implements ShouldBeUnique, ShouldQueue
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
        return 'authorise-capture-tamara-'.$this->paymentId;
    }

    public function handle(): void
    {
        $payment = Payment::query()->find($this->paymentId);
        if (! $payment instanceof Payment
            || $payment->provider !== 'tamara'
            || in_array($payment->status, ['completed', 'needs_review', 'refunded'], true)
            || ! is_string($payment->external_reference)
            || $payment->external_reference === '') {
            return;
        }

        app(TamaraGateway::class)->authoriseAndCapture(
            $payment->external_reference,
            (int) $payment->amount_minor,
            (string) $payment->currency_code,
            $payment->rid,
        );
    }
}
