<?php

declare(strict_types=1);

use App\Http\Controllers\StorefrontPageController;
use Illuminate\Support\Facades\Route;

// Storefront pages served with their meta tags in <head>. No middleware group
// on purpose (no session, cookie or CSRF). The gateway routes only these paths
// here; see docker/nginx/spa.conf.template.
Route::get('/', [StorefrontPageController::class, 'page'])->name('storefront.home');
Route::get('/categories', [StorefrontPageController::class, 'page'])->name('storefront.categories');
Route::get('/categories/{category}', [StorefrontPageController::class, 'page'])->name('storefront.category');
Route::get('/products/{product}', [StorefrontPageController::class, 'page'])->name('storefront.product');
Route::get('/sitemap.xml', [StorefrontPageController::class, 'sitemap'])->name('storefront.sitemap');
Route::get('/robots.txt', [StorefrontPageController::class, 'robots'])->name('storefront.robots');
