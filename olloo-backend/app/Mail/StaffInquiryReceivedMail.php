<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\Inquiry;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

final class StaffInquiryReceivedMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(public readonly Inquiry $inquiry) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'New '.$this->inquiry->type.' inquiry from '.$this->inquiry->name,
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.staff.inquiry-received');
    }
}
