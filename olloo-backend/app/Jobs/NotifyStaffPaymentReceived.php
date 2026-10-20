<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Mail\StaffPaymentReceivedMail;
use App\Models\Payment;
use App\Services\NotificationRecipientSettings;
use App\Services\StaffNotificationFanout;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;

final class NotifyStaffPaymentReceived implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly int $paymentId) {}

    public function handle(
        NotificationRecipientSettings $recipients,
        StaffNotificationFanout $fanout,
    ): void {
        $payment = Payment::query()->find($this->paymentId);
        if (! $payment instanceof Payment) {
            return;
        }

        $meta = is_array($payment->metadata) ? $payment->metadata : [];
        if (! empty($meta['staff_notified_at'])) {
            return;
        }

        $amount = $payment->currency_code.' '.number_format($payment->amount_minor / 100, 2);
        $emails = $recipients->getEmails(NotificationRecipientSettings::CHANNEL_PAYMENT);

        foreach ($emails as $email) {
            Mail::to($email)->send(new StaffPaymentReceivedMail($payment));
        }

        $fanout->notifyStaffEmails(
            emails: $emails,
            type: 'payment',
            title: 'Payment received',
            message: $amount.' via '.$payment->provider.' ('.$payment->rid.')',
            data: [
                'payment_rid' => $payment->rid,
                'order_rid' => $payment->order?->rid,
            ],
        );

        $meta['staff_notified_at'] = now()->toIso8601String();
        $payment->forceFill(['metadata' => $meta])->save();
    }
}
