<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Services\DeliveryQuoteCache;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/** Rebuilds every product's delivery quotes after shipping rules change. */
final class RefreshDeliveryQuotes implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public function handle(DeliveryQuoteCache $cache): void
    {
        $cache->refreshAll();
    }
}
