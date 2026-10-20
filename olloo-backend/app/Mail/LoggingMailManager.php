<?php

declare(strict_types=1);

namespace App\Mail;

use App\Mail\Transport\LoggingTransport;
use App\Services\EmailLog\EmailLogRecorder;
use Illuminate\Mail\MailManager as BaseMailManager;
use Symfony\Component\Mailer\Transport\TransportInterface;

/**
 * Mail manager that wraps every built transport with LoggingTransport.
 * Other apps can copy this class as-is.
 */
class LoggingMailManager extends BaseMailManager
{
    /**
     * @param  array<string, mixed>  $config
     */
    public function createSymfonyTransport(array $config): TransportInterface
    {
        $transport = parent::createSymfonyTransport($config);

        return new LoggingTransport(
            $transport,
            $this->app->make(EmailLogRecorder::class),
        );
    }
}
