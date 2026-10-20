<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Services\EmailLog\EmailLogRecorder;
use Illuminate\Mail\Events\MessageSending;
use Illuminate\Mail\Events\MessageSent;
use Illuminate\Mail\SendQueuedMailable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\SendQueuedNotifications;
use Illuminate\Queue\Events\JobExceptionOccurred;
use ReflectionClass;
use Symfony\Component\Mime\Email;
use Throwable;

/**
 * Enriches email logs with mailable/notification class names and catches queued failures.
 * Transport wrapper handles sync success/failure; this covers queue + Laravel defaults metadata.
 */
final class RecordOutboundEmail
{
    public function __construct(
        private readonly EmailLogRecorder $recorder,
    ) {}

    public function handleMessageSending(MessageSending $event): void
    {
        $message = $event->message;
        if (! $message instanceof Email) {
            return;
        }

        $this->recorder->start($message, $this->contextFromEventData($event->data));
    }

    public function handleMessageSent(MessageSent $event): void
    {
        $message = $event->message;
        if (! $message instanceof Email) {
            return;
        }

        // Transport may have already finalized; refresh metadata (mailable class, etc.).
        $log = $this->recorder->findByMessage($message);
        if ($log === null) {
            $this->recorder->markSent($message, $this->contextFromEventData($event->data));

            return;
        }

        $context = $this->contextFromEventData($event->data);
        $payload = $this->recorder->extractMessagePayload($message, $context);
        $log->fill([
            'mailable_class' => $payload['mailable_class'] ?? $log->mailable_class,
            'notification_class' => $payload['notification_class'] ?? $log->notification_class,
            'meta' => array_merge($log->meta ?? [], $payload['meta'] ?? []),
        ]);

        if ($log->status->value !== 'sent') {
            $this->recorder->markSent($message, $context);
        } else {
            $log->save();
        }
    }

    public function handleJobExceptionOccurred(JobExceptionOccurred $event): void
    {
        if ($this->recorder->transportHandledFailure()) {
            return;
        }

        $job = $event->job;
        $payload = method_exists($job, 'payload') ? $job->payload() : [];
        $command = $payload['data']['command'] ?? null;

        $instance = null;
        if (is_string($command) && $command !== '') {
            try {
                $instance = unserialize($command, ['allowed_classes' => true]);
            } catch (Throwable) {
                $instance = null;
            }
        }

        if (! $instance instanceof SendQueuedMailable && ! $instance instanceof SendQueuedNotifications) {
            // Some drivers store display name only; fall back to job name.
            $name = method_exists($job, 'resolveName') ? $job->resolveName() : ($payload['displayName'] ?? '');
            if (! is_string($name) || (! str_contains($name, 'SendQueuedMailable') && ! str_contains($name, 'SendQueuedNotifications'))) {
                return;
            }
        }

        $context = [
            'queue' => method_exists($job, 'getQueue') ? $job->getQueue() : ($payload['queue'] ?? null),
            'meta' => [
                'job' => method_exists($job, 'resolveName') ? $job->resolveName() : null,
            ],
        ];

        if ($instance instanceof SendQueuedMailable) {
            $mailable = $this->readProperty($instance, 'mailable');
            $context['mailable_class'] = is_object($mailable) ? $mailable::class : null;
            if (is_object($mailable) && isset($mailable->subject) && is_string($mailable->subject)) {
                $context['subject'] = $mailable->subject;
            }
        }

        if ($instance instanceof SendQueuedNotifications) {
            $notification = $this->readProperty($instance, 'notification');
            $context['notification_class'] = is_object($notification) ? $notification::class : null;
        }

        $this->recorder->recordFailureWithoutMessage($event->exception, $context);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function contextFromEventData(array $data): array
    {
        $mailable = $data['__laravel_mailable'] ?? $data['mailable'] ?? null;
        $notification = $data['__laravel_notification'] ?? $data['notification'] ?? null;

        if (is_object($mailable)) {
            $mailable = $mailable::class;
        }
        if (is_object($notification)) {
            $notification = $notification::class;
        }

        // Laravel password reset / verify email often arrive as notifications.
        if (! is_string($notification) || $notification === '') {
            foreach ($data as $value) {
                if (is_object($value) && is_a($value, Notification::class)) {
                    $notification = $value::class;
                    break;
                }
            }
        }

        return array_filter([
            'mailable_class' => is_string($mailable) ? $mailable : null,
            'notification_class' => is_string($notification) ? $notification : null,
            'locale' => isset($data['locale']) && is_string($data['locale']) ? $data['locale'] : null,
            'meta' => [
                'event_data_keys' => array_keys($data),
            ],
        ], fn ($v) => $v !== null);
    }

    private function readProperty(object $instance, string $property): mixed
    {
        try {
            $ref = new ReflectionClass($instance);
            if (! $ref->hasProperty($property)) {
                return null;
            }
            $prop = $ref->getProperty($property);
            $prop->setAccessible(true);

            return $prop->getValue($instance);
        } catch (Throwable) {
            return null;
        }
    }
}
