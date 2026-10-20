<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\Payment;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

final class StaffPaymentReceivedMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(public readonly Payment $payment) {}

    public function envelope(): Envelope
    {
        $amount = number_format($this->payment->amount_minor / 100, 2);

        return new Envelope(
            subject: 'Payment received: '.$this->payment->currency_code.' '.$amount,
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.staff.payment-received');
    }
}
