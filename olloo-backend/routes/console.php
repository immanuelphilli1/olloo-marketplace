<?php

use App\Models\IdempotencyKey;
use App\Models\ProductImport;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('orders:expire-unpaid')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('currency:update-rates')->twiceDaily()->withoutOverlapping();
Schedule::command('model:prune', ['--model' => [IdempotencyKey::class, ProductImport::class]])->daily();
