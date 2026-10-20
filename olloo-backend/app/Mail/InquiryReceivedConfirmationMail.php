<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\Inquiry;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

final class InquiryReceivedConfirmationMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(public readonly Inquiry $inquiry) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'We received your HandCO inquiry',
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.customer.inquiry-confirmation');
    }
}
