<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\DeliveryQuoteCache;
use Illuminate\Console\Command;

/** Run after changing SHIPPING_DEFAULT_HANDLING_DAYS or after a deploy that touched shipping. */
final class RefreshDeliveryQuotesCommand extends Command
{
    protected $signature = 'delivery:refresh';

    protected $description = 'Rebuild the precomputed delivery fee and days for every product';

    public function handle(DeliveryQuoteCache $cache): int
    {
        $this->info('Refreshed delivery quotes for '.$cache->refreshAll().' products.');

        return self::SUCCESS;
    }
}
