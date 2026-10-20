<?php

declare(strict_types=1);

namespace App\Mail\Transport;

use App\Services\EmailLog\EmailLogRecorder;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\TransportInterface;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\RawMessage;
use Throwable;

/**
 * Wraps any Symfony mail transport so every send (success or failure) is written to email_logs.
 */
final class LoggingTransport implements TransportInterface
{
    public function __construct(
        private readonly TransportInterface $inner,
        private readonly EmailLogRecorder $recorder,
    ) {}

    public function send(RawMessage $message, ?Envelope $envelope = null): ?SentMessage
    {
        $email = $message instanceof Email ? $message : null;
        $log = $email instanceof Email ? $this->recorder->start($email, [
            'transport' => $this->inner::__toString(),
        ]) : null;

        try {
            $sent = $this->inner->send($message, $envelope);

            if ($email instanceof Email && $log !== null) {
                $this->recorder->markSent($email, [
                    'transport' => $this->inner::__toString(),
                ]);
            }

            return $sent;
        } catch (Throwable $exception) {
            if ($log !== null) {
                $this->recorder->markFailed($log, $exception, $email);
            }

            throw $exception;
        }
    }

    public function __toString(): string
    {
        return 'logging+'.$this->inner::__toString();
    }
}
