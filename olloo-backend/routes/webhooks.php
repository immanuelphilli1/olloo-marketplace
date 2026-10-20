<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\WebhookController;
use Illuminate\Support\Facades\Route;

Route::post('/webhooks/{provider}', WebhookController::class)
    ->name('webhooks.handle');
