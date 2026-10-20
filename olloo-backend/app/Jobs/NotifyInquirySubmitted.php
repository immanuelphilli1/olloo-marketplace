<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Mail\InquiryReceivedConfirmationMail;
use App\Mail\StaffInquiryReceivedMail;
use App\Models\Inquiry;
use App\Services\NotificationRecipientSettings;
use App\Services\StaffNotificationFanout;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;

final class NotifyInquirySubmitted implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly int $inquiryId) {}

    public function handle(
        NotificationRecipientSettings $recipients,
        StaffNotificationFanout $fanout,
    ): void {
        $inquiry = Inquiry::query()->find($this->inquiryId);
        if (! $inquiry instanceof Inquiry) {
            return;
        }

        $emails = $recipients->getEmails(NotificationRecipientSettings::CHANNEL_INQUIRY);

        foreach ($emails as $email) {
            Mail::to($email)->send(new StaffInquiryReceivedMail($inquiry));
        }

        $fanout->notifyStaffEmails(
            emails: $emails,
            type: 'inquiry',
            title: 'New '.$inquiry->type.' inquiry',
            message: $inquiry->name.' ('.$inquiry->email.')',
            data: [
                'inquiry_rid' => $inquiry->rid,
                'inquiry_type' => $inquiry->type,
            ],
        );

        Mail::to($inquiry->email)->send(new InquiryReceivedConfirmationMail($inquiry));
    }
}
