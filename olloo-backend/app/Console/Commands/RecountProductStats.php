<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\ProductStats;
use Illuminate\Console\Command;

final class RecountProductStats extends Command
{
    protected $signature = 'catalog:recount';

    protected $description = 'Recalculate product rating, review count and sold count from reviews and paid orders';

    public function handle(ProductStats $stats): int
    {
        $this->info('Recounted '.$stats->refreshAll().' products.');

        return self::SUCCESS;
    }
}
