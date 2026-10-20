<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Collection;

final class OrderShippedMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    /**
     * @param  Collection<int, array{status: string, description: string|null, occurred_at: string|null}>  $tracking
     */
    public function __construct(
        public readonly Order $order,
        public readonly Collection $tracking,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Your order '.$this->order->order_reference.' is on the way',
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.customer.order-shipped');
    }
}
