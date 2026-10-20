<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Enums\OrderStatus;
use App\Mail\OrderShippedMail;
use App\Models\Order;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;

final class NotifyCustomerOrderShipped implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly int $orderId) {}

    public function handle(): void
    {
        $order = Order::query()->with(['user', 'trackingEvents'])->find($this->orderId);
        if (! $order instanceof Order || $order->status !== OrderStatus::Shipped) {
            return;
        }

        $snapshot = is_array($order->shipping_snapshot) ? $order->shipping_snapshot : [];
        if (! empty($snapshot['shipped_notified_at'])) {
            return;
        }

        $email = $this->resolveCustomerEmail($order);
        if ($email === null) {
            return;
        }

        if (! $this->shouldNotify($order->user)) {
            return;
        }

        $tracking = $order->trackingEvents
            ->sortBy('occurred_at')
            ->values()
            ->map(fn ($event) => [
                'status' => (string) $event->label,
                'description' => $event->description,
                'occurred_at' => $event->occurred_at?->toDayDateTimeString(),
            ]);

        Mail::to($email)->send(new OrderShippedMail($order, $tracking));

        $snapshot['shipped_notified_at'] = now()->toIso8601String();
        $order->forceFill(['shipping_snapshot' => $snapshot])->save();
    }

    private function resolveCustomerEmail(Order $order): ?string
    {
        $userEmail = $order->user?->email;
        if (is_string($userEmail) && $userEmail !== '') {
            return $userEmail;
        }

        $address = is_array($order->address_snapshot) ? $order->address_snapshot : [];
        $snapEmail = $address['email'] ?? null;

        return is_string($snapEmail) && $snapEmail !== '' ? $snapEmail : null;
    }

    private function shouldNotify(?User $user): bool
    {
        if ($user === null) {
            return true;
        }

        return (bool) $user->notify_order_updates;
    }
}
