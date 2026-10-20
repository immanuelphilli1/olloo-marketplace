<?php

declare(strict_types=1);

namespace Tests\Unit;

use Illuminate\Support\Facades\File;
use Tests\TestCase;

/**
 * env() only works while the config is uncached. Under `php artisan
 * config:cache` (what production runs) Laravel skips loading .env entirely, so
 * every env() call outside a config file silently returns its default.
 *
 * That is a quiet failure, not a crash: a migration reading env() backfills a
 * hardcoded guess instead of the value the site was actually configured with.
 * This test keeps env() inside config/ where it belongs.
 */
final class NoEnvOutsideConfigTest extends TestCase
{
    /** @var list<string> */
    private const SCANNED = [
        'app',
        'bootstrap',
        'routes',
        'database/seeders',
        'database/factories',
        'resources/js',
        'tests',
    ];

    public function test_env_is_only_called_inside_config_files(): void
    {
        $offenders = [];

        foreach (self::SCANNED as $directory) {
            $path = base_path($directory);
            if (! File::isDirectory($path)) {
                continue;
            }

            foreach (File::allFiles($path) as $file) {
                if ($file->getExtension() !== 'php') {
                    continue;
                }

                // Blade views legitimately read config, never env, but they are
                // .blade.php so they are not scanned here.
                if ($file->getPathname() === __FILE__) {
                    // This file names env() and getenv() in its own patterns.
                    continue;
                }

                if (preg_match('/\benv\s*\(/', $file->getContents()) === 1) {
                    $offenders[] = str_replace(base_path().'/', '', $file->getPathname());
                }
            }
        }

        $this->assertSame(
            [],
            $offenders,
            "env() outside config/ returns null once config is cached. Read config('...') instead: ".implode(', ', $offenders),
        );
    }

    public function test_getenv_and_superglobals_are_not_used_either(): void
    {
        $offenders = [];

        foreach (self::SCANNED as $directory) {
            $path = base_path($directory);
            if (! File::isDirectory($path)) {
                continue;
            }

            foreach (File::allFiles($path) as $file) {
                if ($file->getExtension() !== 'php') {
                    continue;
                }

                if ($file->getPathname() === __FILE__) {
                    continue;
                }

                $contents = $file->getContents();
                if (preg_match('/\bgetenv\s*\(|\$_ENV\[|\$_SERVER\[/', $contents) === 1) {
                    $offenders[] = str_replace(base_path().'/', '', $file->getPathname());
                }
            }
        }

        $this->assertSame(
            [],
            $offenders,
            'Read configuration through config() rather than the environment directly: '.implode(', ', $offenders),
        );
    }
}
