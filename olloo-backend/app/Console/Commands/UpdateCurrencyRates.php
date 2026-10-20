<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Currency\ExchangeRateUpdater;
use Illuminate\Console\Command;
use RuntimeException;

class UpdateCurrencyRates extends Command
{
    protected $signature = 'currency:update-rates';

    protected $description = 'Fetch exchange rates for every configured currency pair (scheduled twice daily)';

    public function handle(ExchangeRateUpdater $updater): int
    {
        try {
            $result = $updater->update();
        } catch (RuntimeException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info("Stored {$result['pairs']} pairs against {$result['base']} from {$result['source']}.");

        if ($result['missing'] !== []) {
            // Shoppers in these currencies see the default currency until a rate exists.
            $this->warn('No rate for: '.implode(', ', $result['missing']));

            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
