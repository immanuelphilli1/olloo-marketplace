<?php

declare(strict_types=1);

use App\Http\Controllers\Admin\Auth\AdminAuthController;
use App\Http\Controllers\Admin\Auth\MfaController;
use App\Http\Controllers\Admin\CategoryController;
use App\Http\Controllers\Admin\ContentPageController;
use App\Http\Controllers\Admin\CountryController;
use App\Http\Controllers\Admin\CurrencyRateController;
use App\Http\Controllers\Admin\CustomerController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\EmailLogController;
use App\Http\Controllers\Admin\InhousePlacementController;
use App\Http\Controllers\Admin\InquiryController;
use App\Http\Controllers\Admin\NewsletterController;
use App\Http\Controllers\Admin\NotificationController;
use App\Http\Controllers\Admin\NotificationSettingsController;
use App\Http\Controllers\Admin\OrderController;
use App\Http\Controllers\Admin\PaymentController;
use App\Http\Controllers\Admin\PaymentMethodController;
use App\Http\Controllers\Admin\ProductController;
use App\Http\Controllers\Admin\ProductImportController;
use App\Http\Controllers\Admin\RequestHistoryController;
use App\Http\Controllers\Admin\ReviewController;
use App\Http\Controllers\Admin\ShippingClassController;
use App\Http\Controllers\Admin\ShippingRuleController;
use App\Http\Controllers\Admin\StaffController;
use App\Http\Controllers\Admin\TagController;
use App\Http\Controllers\Admin\TaxController;
use App\Http\Controllers\Admin\UploadController;
use App\Http\Controllers\Admin\WebhookEventController;
use Illuminate\Support\Facades\Route;

$prefix = config('admin.path_prefix');

Route::prefix($prefix)
    ->name('admin.')
    ->middleware('web')
    ->group(function (): void {
        Route::middleware('guest:staff')->group(function (): void {
            Route::get('login', [AdminAuthController::class, 'showLogin'])->name('login');
            Route::post('login', [AdminAuthController::class, 'login'])->name('login.store');
        });

        Route::middleware('auth:staff')->group(function (): void {
            Route::post('logout', [AdminAuthController::class, 'logout'])->name('logout');

            Route::get('password/force', [AdminAuthController::class, 'showForcePassword'])->name('password.force');
            Route::post('password/force', [AdminAuthController::class, 'updateForcePassword'])->name('password.force.update');

            Route::middleware('staff.password')->group(function (): void {
                Route::get('mfa/setup', [MfaController::class, 'showSetup'])->name('mfa.setup');
                Route::post('mfa/setup', [MfaController::class, 'storeSetup'])->name('mfa.setup.store');
                Route::get('mfa/verify', [MfaController::class, 'showVerify'])->name('mfa.verify');
                Route::post('mfa/verify', [MfaController::class, 'storeVerify'])->name('mfa.verify.store');

                Route::middleware('staff.mfa')->group(function (): void {
                    Route::get('/', DashboardController::class)->name('dashboard');

                    Route::post('uploads', [UploadController::class, 'store'])->name('uploads.store');
                    Route::post('uploads/video', [UploadController::class, 'storeVideo'])->name('uploads.video');

                    Route::get('products', [ProductController::class, 'index'])->name('products.index');
                    Route::get('products/export', [ProductController::class, 'export'])->name('products.export');
                    Route::get('products/create', [ProductController::class, 'create'])->name('products.create');
                    Route::post('products', [ProductController::class, 'store'])->name('products.store');
                    Route::get('products/{product}/edit', [ProductController::class, 'edit'])->name('products.edit');
                    Route::put('products/{product}', [ProductController::class, 'update'])->name('products.update');
                    Route::delete('products/{product}', [ProductController::class, 'destroy'])->name('products.destroy');

                    Route::get('product-imports', [ProductImportController::class, 'index'])->name('products.import.index');
                    Route::get('product-imports/{import}', [ProductImportController::class, 'show'])->name('products.import.show');

                    Route::get('products-import', [ProductImportController::class, 'csvIndex'])->name('products.import.csv');
                    Route::get('products-import/template', [ProductImportController::class, 'csvTemplate'])->name('products.import.csv.template');
                    Route::post('products-import', [ProductImportController::class, 'csvPreview'])->name('products.import.csv.preview');
                    Route::get('products-import/{token}', [ProductImportController::class, 'csvShow'])->name('products.import.csv.show');
                    Route::post('products-import/{token}/apply', [ProductImportController::class, 'csvApply'])->name('products.import.csv.apply');

                    Route::get('product-images-import', [ProductImportController::class, 'imagesIndex'])->name('products.import.images');
                    Route::post('product-images-import', [ProductImportController::class, 'imagesPreview'])->name('products.import.images.preview');
                    Route::get('product-images-import/{token}', [ProductImportController::class, 'imagesShow'])->name('products.import.images.show');
                    Route::post('product-images-import/{token}/apply', [ProductImportController::class, 'imagesApply'])->name('products.import.images.apply');

                    Route::get('categories', [CategoryController::class, 'index'])->name('categories.index');
                    Route::get('categories/export', [CategoryController::class, 'export'])->name('categories.export');
                    Route::get('categories/create', [CategoryController::class, 'create'])->name('categories.create');
                    Route::post('categories', [CategoryController::class, 'store'])->name('categories.store');
                    Route::get('categories/{category}', [CategoryController::class, 'show'])->name('categories.show');
                    Route::get('categories/{category}/edit', [CategoryController::class, 'edit'])->name('categories.edit');
                    Route::put('categories/{category}', [CategoryController::class, 'update'])->name('categories.update');
                    Route::delete('categories/{category}', [CategoryController::class, 'destroy'])->name('categories.destroy');

                    Route::get('countries', [CountryController::class, 'index'])->name('countries.index');
                    Route::post('countries/sync', [CountryController::class, 'sync'])->name('countries.sync');
                    Route::get('countries/{country}', [CountryController::class, 'show'])->name('countries.show');

                    Route::get('tags', [TagController::class, 'index'])->name('tags.index');
                    Route::put('tags/{tag}', [TagController::class, 'update'])->name('tags.update');
                    Route::post('tags/{tag}/merge', [TagController::class, 'merge'])->name('tags.merge');
                    Route::delete('tags/{tag}', [TagController::class, 'destroy'])->name('tags.destroy');

                    Route::get('orders', [OrderController::class, 'index'])->name('orders.index');
                    Route::get('orders/{order}', [OrderController::class, 'show'])->name('orders.show');
                    Route::put('orders/{order}/status', [OrderController::class, 'updateStatus'])->name('orders.updateStatus');

                    Route::get('payments', [PaymentController::class, 'index'])->name('payments.index');
                    Route::get('payments/{payment}', [PaymentController::class, 'show'])->name('payments.show');
                    Route::post('payments/{payment}/recheck', [PaymentController::class, 'recheck'])->name('payments.recheck');

                    Route::get('webhooks', [WebhookEventController::class, 'index'])->name('webhooks.index');
                    Route::get('webhooks/{webhook}', [WebhookEventController::class, 'show'])->name('webhooks.show');
                    Route::post('webhooks/{webhook}/replay', [WebhookEventController::class, 'replay'])->name('webhooks.replay');

                    Route::get('customers', [CustomerController::class, 'index'])->name('customers.index');
                    Route::get('customers/{customer}', [CustomerController::class, 'show'])->name('customers.show');

                    Route::get('reviews', [ReviewController::class, 'index'])->name('reviews.index');
                    Route::put('reviews/{review}/status', [ReviewController::class, 'updateStatus'])->name('reviews.updateStatus');
                    Route::delete('reviews/{review}', [ReviewController::class, 'destroy'])->name('reviews.destroy');

                    Route::get('cms', [ContentPageController::class, 'index'])->name('cms.index');
                    Route::get('cms/{page}/edit', [ContentPageController::class, 'edit'])->name('cms.edit');
                    Route::put('cms/{page}', [ContentPageController::class, 'update'])->name('cms.update');
                    Route::get('placements', [InhousePlacementController::class, 'index'])->name('placements.index');
                    Route::get('placements/create', [InhousePlacementController::class, 'create'])->name('placements.create');
                    Route::post('placements', [InhousePlacementController::class, 'store'])->name('placements.store');
                    Route::get('placements/{placement}/edit', [InhousePlacementController::class, 'edit'])->name('placements.edit');
                    Route::put('placements/{placement}', [InhousePlacementController::class, 'update'])->name('placements.update');
                    Route::delete('placements/{placement}', [InhousePlacementController::class, 'destroy'])->name('placements.destroy');

                    Route::get('inquiries', [InquiryController::class, 'index'])->name('inquiries.index');
                    Route::get('inquiries/{inquiry}', [InquiryController::class, 'show'])->name('inquiries.show');

                    Route::get('newsletter', [NewsletterController::class, 'index'])->name('newsletter.index');
                    Route::delete('newsletter/{subscriber}', [NewsletterController::class, 'destroy'])->name('newsletter.destroy');

                    Route::get('staff', [StaffController::class, 'index'])->name('staff.index');
                    Route::get('staff/create', [StaffController::class, 'create'])->name('staff.create');
                    Route::post('staff', [StaffController::class, 'store'])->name('staff.store');
                    Route::get('staff/{staff}/edit', [StaffController::class, 'edit'])->name('staff.edit');
                    Route::put('staff/{staff}', [StaffController::class, 'update'])->name('staff.update');
                    Route::delete('staff/{staff}', [StaffController::class, 'destroy'])->name('staff.destroy');

                    Route::get('request-history', [RequestHistoryController::class, 'index'])->name('request-history.index');
                    Route::get('request-history/entity', [RequestHistoryController::class, 'forEntity'])->name('request-history.entity');
                    Route::get('request-history/{log}', [RequestHistoryController::class, 'show'])->name('request-history.show');

                    Route::get('email-logs', [EmailLogController::class, 'index'])->name('email-logs.index');
                    Route::get('email-logs/{emailLog}/preview', [EmailLogController::class, 'previewHtml'])->name('email-logs.preview');
                    Route::get('email-logs/{emailLog}/download', [EmailLogController::class, 'download'])->name('email-logs.download');
                    Route::get('email-logs/{emailLog}', [EmailLogController::class, 'show'])->name('email-logs.show');

                    Route::get('notifications', [NotificationController::class, 'index'])->name('notifications.index');
                    Route::get('notifications/unread-count', [NotificationController::class, 'unreadCount'])->name('notifications.unread-count');
                    Route::post('notifications/mark-all-read', [NotificationController::class, 'markAllAsRead'])->name('notifications.mark-all-read');
                    Route::post('notifications/bulk', [NotificationController::class, 'bulkUpdate'])->name('notifications.bulk');
                    Route::post('notifications/{notification}/read', [NotificationController::class, 'markAsRead'])->name('notifications.read');
                    Route::post('notifications/{notification}/unread', [NotificationController::class, 'markAsUnread'])->name('notifications.unread');
                    Route::delete('notifications/{notification}', [NotificationController::class, 'destroy'])->name('notifications.destroy');

                    Route::get('settings/notifications', [NotificationSettingsController::class, 'edit'])->name('notification-settings.edit');
                    Route::put('settings/notifications', [NotificationSettingsController::class, 'update'])->name('notification-settings.update');

                    Route::get('settings/currencies', [CurrencyRateController::class, 'index'])->name('currencies.index');
                    Route::put('settings/currencies/markup', [CurrencyRateController::class, 'updateDefaultMarkup'])->name('currencies.markup.update');
                    Route::put('settings/currencies/pairs/{currencyConversion}', [CurrencyRateController::class, 'updatePair'])->name('currencies.pairs.update');
                    Route::post('settings/currencies/refresh', [CurrencyRateController::class, 'refresh'])->name('currencies.refresh');

                    Route::get('settings/taxes', [TaxController::class, 'index'])->name('taxes.index');
                    Route::post('settings/taxes/rates', [TaxController::class, 'storeRate'])->name('taxes.rates.store');
                    Route::put('settings/taxes/rates/{taxRate}', [TaxController::class, 'updateRate'])->name('taxes.rates.update');
                    Route::delete('settings/taxes/rates/{taxRate}', [TaxController::class, 'destroyRate'])->name('taxes.rates.destroy');
                    Route::post('settings/taxes/classes', [TaxController::class, 'storeClass'])->name('taxes.classes.store');
                    Route::put('settings/taxes/classes/{taxClass}', [TaxController::class, 'updateClass'])->name('taxes.classes.update');
                    Route::delete('settings/taxes/classes/{taxClass}', [TaxController::class, 'destroyClass'])->name('taxes.classes.destroy');

                    Route::get('settings/shipping-classes', [ShippingClassController::class, 'index'])->name('shipping-classes.index');
                    Route::post('settings/shipping-classes', [ShippingClassController::class, 'store'])->name('shipping-classes.store');
                    Route::put('settings/shipping-classes/{shippingClass}', [ShippingClassController::class, 'update'])->name('shipping-classes.update');
                    Route::delete('settings/shipping-classes/{shippingClass}', [ShippingClassController::class, 'destroy'])->name('shipping-classes.destroy');

                    Route::get('settings/shipping', [ShippingRuleController::class, 'index'])->name('shipping-rules.index');
                    Route::get('settings/shipping/create', [ShippingRuleController::class, 'create'])->name('shipping-rules.create');
                    Route::post('settings/shipping', [ShippingRuleController::class, 'store'])->name('shipping-rules.store');
                    Route::get('settings/shipping/test-quote', [ShippingRuleController::class, 'testQuote'])->name('shipping-rules.test-quote');
                    Route::get('settings/shipping/{shippingRule}/edit', [ShippingRuleController::class, 'edit'])->name('shipping-rules.edit');
                    Route::put('settings/shipping/{shippingRule}', [ShippingRuleController::class, 'update'])->name('shipping-rules.update');
                    Route::delete('settings/shipping/{shippingRule}', [ShippingRuleController::class, 'destroy'])->name('shipping-rules.destroy');
                    Route::post('settings/shipping/{shippingRule}/toggle', [ShippingRuleController::class, 'toggle'])->name('shipping-rules.toggle');

                    Route::get('settings/payment-methods', [PaymentMethodController::class, 'index'])->name('payment-methods.index');
                    Route::post('settings/payment-methods', [PaymentMethodController::class, 'store'])->name('payment-methods.store');
                    Route::put('settings/payment-methods/{paymentMethod}', [PaymentMethodController::class, 'update'])->name('payment-methods.update');
                    Route::delete('settings/payment-methods/{paymentMethod}', [PaymentMethodController::class, 'destroy'])->name('payment-methods.destroy');
                    Route::post('settings/payment-methods/{paymentMethod}/toggle', [PaymentMethodController::class, 'toggle'])->name('payment-methods.toggle');
                    Route::put('settings/currencies/{currency}', [PaymentMethodController::class, 'updateCurrency'])->name('currencies.update');
                });
            });
        });
    });
