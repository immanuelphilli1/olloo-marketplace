<?php

declare(strict_types=1);

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Artisan;
use RuntimeException;

/** Runs `countries:sync` off the request so the admin page stays fast. */
final class SyncCountriesJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        $exitCode = Artisan::call('countries:sync');

        if ($exitCode !== 0) {
            $output = trim(Artisan::output());

            throw new RuntimeException($output !== '' ? "countries:sync failed: {$output}" : "countries:sync failed with exit code {$exitCode}.");
        }
    }
}
