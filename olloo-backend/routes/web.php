<?php

declare(strict_types=1);

use App\Http\Controllers\CheckoutReturnController;
use App\Http\Controllers\MailBrandAssetController;
use Illuminate\Support\Facades\Route;

Route::get('/images/mail/{rid}.png', MailBrandAssetController::class)
    ->where('rid', '[A-Za-z0-9]{8,32}')
    ->name('mail.brand-asset');

// Gateway redirects land here first, one path per provider, matching
// payments.providers.*.return_url / cancel_return_url. We verify the payment
// with the provider, then bounce the shopper to the storefront. Public: the
// shopper may have no session, and the reference is the only thing exposed.
Route::get('/checkout/return/{provider}', [CheckoutReturnController::class, 'success'])
    ->where('provider', '[a-z0-9_]+')
    ->name('checkout.return');

Route::get('/checkout/cancel/{provider}', [CheckoutReturnController::class, 'cancel'])
    ->where('provider', '[a-z0-9_]+')
    ->name('checkout.cancel');
