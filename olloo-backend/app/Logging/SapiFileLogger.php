<?php

declare(strict_types=1);

namespace App\Logging;

use Monolog\Handler\RotatingFileHandler;
use Monolog\Handler\StreamHandler;
use Monolog\Logger;
use Monolog\Processor\PsrLogMessageProcessor;

/**
 * File logger that separates CLI output (artisan, queue workers, scheduler)
 * from PHP-FPM output. The two SAPIs run as different OS users, so sharing
 * one laravel.log means whichever user creates the file locks the other out
 * with "Permission denied". One file per SAPI removes the fight entirely.
 *
 * Resolved at runtime (not config load), so it stays correct when the
 * config is cached by a CLI build.
 */
final class SapiFileLogger
{
    public function __invoke(array $config): Logger
    {
        $sapi = PHP_SAPI === 'cli' ? 'cli' : 'fpm';
        $path = storage_path("logs/laravel-{$sapi}.log");
        $level = $config['level'] ?? 'debug';

        $handler = ($config['rotating'] ?? false)
            ? new RotatingFileHandler($path, (int) ($config['days'] ?? 14), $level)
            : new StreamHandler($path, $level);

        $logger = new Logger('handco', [$handler]);
        $logger->pushProcessor(new PsrLogMessageProcessor);

        return $logger;
    }
}
