<?php

declare(strict_types=1);

use App\Currency\ExchangeRateUnavailable;
use App\Http\Middleware\EnforceIdempotencyKey;
use App\Http\Middleware\EnsureStaffMfaVerified;
use App\Http\Middleware\EnsureStaffPasswordChanged;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SetSanctumApiGuard;
use App\Shipping\ShippingConfigurationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function (): void {
            require __DIR__.'/../routes/webhooks.php';
            require __DIR__.'/../routes/storefront.php';
            require __DIR__.'/../routes/admin.php';
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'staff.mfa' => EnsureStaffMfaVerified::class,
            'staff.password' => EnsureStaffPasswordChanged::class,
            'idempotent' => EnforceIdempotencyKey::class,
        ]);

        $middleware->web(append: [
            HandleInertiaRequests::class,
        ]);

        $middleware->api(append: [
            SetSanctumApiGuard::class,
        ]);

        $middleware->redirectGuestsTo(function (Request $request): string {
            if ($request->is(config('admin.path_prefix').'/*') || $request->is(config('admin.path_prefix'))) {
                return route('admin.login');
            }

            return route('admin.login');
        });

        $middleware->redirectUsersTo(function (): string {
            return route('admin.dashboard');
        });
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (ValidationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return api_error(
                    'validation_error',
                    $e->getMessage(),
                    422,
                    $e->errors()
                );
            }
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return api_error('unauthenticated', 'Unauthenticated.', 401);
            }
        });

        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return api_error('not_found', 'Resource not found.', 404);
            }
        });

        $exceptions->render(function (ShippingConfigurationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return api_error('invalid_shipping_config', $e->getMessage(), 500);
            }
        });

        $exceptions->render(function (ExchangeRateUnavailable $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return api_error('exchange_rate_unavailable', 'Prices in this currency are temporarily unavailable. Try again shortly.', 503);
            }
        });

        $exceptions->render(function (Throwable $e, Request $request) {
            if (! ($request->is('api/*') || $request->expectsJson())) {
                return null;
            }

            if ($e instanceof HttpExceptionInterface) {
                return api_error(
                    'http_error',
                    $e->getMessage() !== '' ? $e->getMessage() : 'Request failed.',
                    $e->getStatusCode()
                );
            }

            if (! config('app.debug')) {
                return api_error('server_error', 'Server error.', 500);
            }

            return api_error('server_error', $e->getMessage(), 500);
        });
    })->create();
