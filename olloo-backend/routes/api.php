<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\AddressController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BrowsingHistoryController;
use App\Http\Controllers\Api\V1\CartController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\CheckoutController;
use App\Http\Controllers\Api\V1\ContentController;
use App\Http\Controllers\Api\V1\InquiryController;
use App\Http\Controllers\Api\V1\LocaleController;
use App\Http\Controllers\Api\V1\NewsletterController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\PaymentController;
use App\Http\Controllers\Api\V1\PaymentMethodController;
use App\Http\Controllers\Api\V1\PlacementController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\ProfileController;
use App\Http\Controllers\Api\V1\ReviewController;
use App\Http\Controllers\Api\V1\SearchController;
use App\Http\Controllers\Api\V1\SeoController;
use App\Http\Controllers\Api\V1\WishlistController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->name('api.v1.')->group(function (): void {
    Route::prefix('auth')->name('auth.')->group(function (): void {
        Route::post('check-email', [AuthController::class, 'checkEmail'])->name('check-email');
        Route::post('check-phone', [AuthController::class, 'checkPhone'])->name('check-phone');
        Route::post('login', [AuthController::class, 'login'])->name('login');
        Route::post('register', [AuthController::class, 'register'])->name('register');
        Route::get('oauth/{provider}/url', [AuthController::class, 'oauthUrl'])->name('oauth.url');
        Route::post('oauth/{provider}', [AuthController::class, 'oauth'])->name('oauth');
        Route::post('forgot-password', [AuthController::class, 'forgotPassword'])->name('forgot-password');
        Route::post('reset-password', [AuthController::class, 'resetPassword'])->name('reset-password');
        Route::post('refresh', [AuthController::class, 'refresh'])->name('refresh');

        Route::middleware('auth:sanctum')->group(function (): void {
            Route::get('me', [AuthController::class, 'me'])->name('me');
            Route::post('logout', [AuthController::class, 'logout'])->name('logout');
        });
    });

    Route::get('locale', [LocaleController::class, 'show'])->name('locale.show');

    Route::get('categories', [CategoryController::class, 'index'])->name('categories.index');
    Route::get('categories/{category}/panel', [CategoryController::class, 'panel'])->name('categories.panel');
    Route::get('categories/{category}', [CategoryController::class, 'show'])->name('categories.show');

    Route::get('products', [ProductController::class, 'index'])->name('products.index');
    Route::get('products/featured', [ProductController::class, 'featured'])->name('products.featured');
    Route::get('products/new-arrivals', [ProductController::class, 'newArrivals'])->name('products.new-arrivals');
    Route::get('products/recommendations', [ProductController::class, 'recommendations'])->name('products.recommendations');
    Route::get('products/{product}', [ProductController::class, 'show'])->name('products.show');
    Route::get('products/{product}/related', [ProductController::class, 'related'])->name('products.related');
    Route::get('products/{product}/reviews', [ProductController::class, 'reviews'])->name('products.reviews');

    Route::get('search/suggestions', [SearchController::class, 'suggestions'])->name('search.suggestions');

    Route::prefix('cart')->name('cart.')->group(function (): void {
        Route::get('/', [CartController::class, 'show'])->name('show');
        Route::post('items', [CartController::class, 'addItem'])->name('items.store');
        Route::patch('items/select-all', [CartController::class, 'selectAll'])->name('items.select-all');
        Route::delete('items', [CartController::class, 'removeSelected'])->name('items.destroy-selected');
        Route::patch('items/{item}', [CartController::class, 'updateItem'])->name('items.update');
        Route::delete('items/{item}', [CartController::class, 'removeItem'])->name('items.destroy');
        Route::post('items/move-to-wishlist', [CartController::class, 'moveSelectedToWishlist'])->middleware('auth:sanctum')->name('items.move-to-wishlist');
        Route::post('merge', [CartController::class, 'merge'])->middleware('auth:sanctum')->name('merge');
    });

    Route::get('checkout/preview', [CheckoutController::class, 'preview'])->name('checkout.preview');
    Route::post('checkout/shipping-quote', [CheckoutController::class, 'shippingQuote'])->name('checkout.shipping-quote');
    Route::post('checkout/payment-intent', [CheckoutController::class, 'paymentIntent'])->middleware('idempotent')->name('checkout.payment-intent');

    Route::get('addresses/lookup/countries', [AddressController::class, 'lookupCountries'])->name('addresses.lookup.countries');
    Route::get('addresses/lookup/regions', [AddressController::class, 'lookupRegions'])->name('addresses.lookup.regions');
    Route::get('addresses/lookup/cities', [AddressController::class, 'lookupCities'])->name('addresses.lookup.cities');

    Route::get('payment-methods/networks', [PaymentMethodController::class, 'networks'])->name('payment-methods.networks');
    Route::get('payment-methods/checkout', [PaymentMethodController::class, 'checkoutOptions'])->name('payment-methods.checkout');

    Route::get('content/pages/{slug}', [ContentController::class, 'page'])->name('content.pages.show');
    Route::get('content/home', [ContentController::class, 'home'])->name('content.home');
    Route::get('placements/{page}', [PlacementController::class, 'index'])->name('placements.index');
    Route::get('seo', [SeoController::class, 'show'])->name('seo.show');
    Route::get('content/footer', [ContentController::class, 'footer'])->name('content.footer');

    Route::post('newsletter/subscribe', [NewsletterController::class, 'subscribe'])->name('newsletter.subscribe');
    Route::post('newsletter/unsubscribe', [NewsletterController::class, 'unsubscribe'])->name('newsletter.unsubscribe');

    Route::post('partnerships/inquiries', [InquiryController::class, 'partnership'])->name('partnerships.inquiries');
    Route::post('quotations', [InquiryController::class, 'quotation'])->name('quotations.store');
    Route::post('support/agent-requests', [InquiryController::class, 'agent'])->name('support.agent-requests');

    Route::post('browsing-history', [BrowsingHistoryController::class, 'store'])->name('browsing-history.store');

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('wishlist', [WishlistController::class, 'index'])->name('wishlist.index');
        Route::get('wishlist/categories', [WishlistController::class, 'categories'])->name('wishlist.categories');
        Route::post('wishlist/{product}', [WishlistController::class, 'store'])->name('wishlist.store');
        Route::delete('wishlist/{product}', [WishlistController::class, 'destroy'])->name('wishlist.destroy');

        Route::get('orders/buy-again', [OrderController::class, 'buyAgain'])->name('orders.buy-again');
        Route::get('payments/{payment}', [PaymentController::class, 'show'])->name('payments.show');
        Route::get('orders', [OrderController::class, 'index'])->name('orders.index');
        Route::post('orders', [OrderController::class, 'store'])->middleware('idempotent')->name('orders.store');
        Route::get('orders/{order}', [OrderController::class, 'show'])->name('orders.show');
        Route::post('orders/{order}/buy-again', [OrderController::class, 'buyAgainFromOrder'])->name('orders.buy-again-from-order');
        Route::post('orders/{order}/cancel', [OrderController::class, 'cancel'])->name('orders.cancel');
        Route::post('orders/{order}/return', [OrderController::class, 'returnRequest'])->name('orders.return');
        Route::get('orders/{order}/tracking', [OrderController::class, 'tracking'])->name('orders.tracking');

        Route::get('users/me/profile', [ProfileController::class, 'show'])->name('users.profile.show');
        Route::patch('users/me/profile', [ProfileController::class, 'update'])->name('users.profile.update');
        Route::put('users/me/country', [ProfileController::class, 'updateCountry'])->name('users.profile.country');
        Route::get('users/me/security', [ProfileController::class, 'security'])->name('users.security');
        Route::patch('users/me/email', [ProfileController::class, 'updateEmail'])->name('users.email');
        Route::patch('users/me/phone', [ProfileController::class, 'updatePhone'])->name('users.phone');
        Route::patch('users/me/password', [ProfileController::class, 'updatePassword'])->name('users.password');
        Route::post('users/me/2fa/enable', [ProfileController::class, 'enableTwoFactor'])->name('users.2fa.enable');
        Route::post('users/me/2fa/disable', [ProfileController::class, 'disableTwoFactor'])->name('users.2fa.disable');
        Route::delete('users/me', [ProfileController::class, 'destroy'])->name('users.destroy');

        Route::get('addresses', [AddressController::class, 'index'])->name('addresses.index');
        Route::post('addresses', [AddressController::class, 'store'])->name('addresses.store');
        Route::patch('addresses/{address}', [AddressController::class, 'update'])->name('addresses.update');
        Route::delete('addresses/{address}', [AddressController::class, 'destroy'])->name('addresses.destroy');
        Route::patch('addresses/{address}/default', [AddressController::class, 'setDefault'])->name('addresses.default');
        Route::post('addresses/{address}/duplicate', [AddressController::class, 'duplicate'])->name('addresses.duplicate');

        Route::get('payment-methods', [PaymentMethodController::class, 'index'])->name('payment-methods.index');
        Route::delete('payment-methods/{paymentMethod}', [PaymentMethodController::class, 'destroy'])->name('payment-methods.destroy');
        Route::patch('payment-methods/{paymentMethod}/default', [PaymentMethodController::class, 'setDefault'])->name('payment-methods.default');

        Route::get('reviews/waiting', [ReviewController::class, 'waiting'])->name('reviews.waiting');
        Route::get('reviews/reviewed', [ReviewController::class, 'reviewed'])->name('reviews.reviewed');
        Route::post('reviews', [ReviewController::class, 'store'])->name('reviews.store');

        Route::get('browsing-history', [BrowsingHistoryController::class, 'index'])->name('browsing-history.index');
        Route::delete('browsing-history', [BrowsingHistoryController::class, 'destroy'])->name('browsing-history.destroy');
        Route::delete('browsing-history/all', [BrowsingHistoryController::class, 'destroyAll'])->name('browsing-history.destroy-all');

        Route::get('notifications/settings', [NotificationController::class, 'settings'])->name('notifications.settings.index');
        Route::patch('notifications/settings/{id}', [NotificationController::class, 'updateSetting'])->name('notifications.settings.update');
    });
});
