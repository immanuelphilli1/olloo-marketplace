<?php

declare(strict_types=1);
use App\Payments\Gateways\FakeGateway;
use App\Payments\Gateways\PaypalGateway;
use App\Payments\Gateways\PaystackGateway;
use App\Payments\Gateways\StripeGateway;
use App\Payments\Gateways\TabbyGateway;
use App\Payments\Gateways\TamaraGateway;

return [
    // No default provider on purpose. Routing is per currency
    // (currencies.payment_provider) and per payment method, so nothing here
    // can quietly pick a gateway that cannot carry the currency.
    //
    // Unpaid orders (awaiting payment) are cancelled and their stock released
    // after this many minutes without a payment attempt.
    'order_payment_window_minutes' => (int) env('PAYMENTS_ORDER_PAYMENT_WINDOW_MINUTES', 60),

    // Each provider owns its return and cancel URLs, the same way Google's
    // OAuth redirect is its own setting rather than one app-wide callback.
    // Gateways redirect the shopper themselves, so they do not share a page:
    // the provider is in both the env var and the default path.
    'providers' => [
        'stripe' => [
            'driver' => StripeGateway::class,
            'publishable_key' => env('STRIPE_KEY'),
            'secret_key' => env('STRIPE_SECRET'),
            'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
            'base_url' => env('STRIPE_API_BASE', 'https://api.stripe.com'),
            'return_url' => env('STRIPE_RETURN_URL', '/checkout/return/stripe'),
            'cancel_return_url' => env('STRIPE_CANCEL_RETURN_URL', '/checkout/cancel/stripe'),
        ],
        'paystack' => [
            'driver' => PaystackGateway::class,
            'public_key' => env('PAYSTACK_PUBLIC_KEY'),
            'secret_key' => env('PAYSTACK_SECRET_KEY'),
            'webhook_secret' => env('PAYSTACK_WEBHOOK_SECRET'),
            'base_url' => env('PAYSTACK_BASE_URL', 'https://api.paystack.co'),
            'return_url' => env('PAYSTACK_RETURN_URL', '/checkout/return/paystack'),
            'cancel_return_url' => env('PAYSTACK_CANCEL_RETURN_URL', '/checkout/cancel/paystack'),
        ],
        // Wallets (Apple Pay, Google Pay) ride on Stripe Checkout: no extra
        // driver, they appear once enabled in the Stripe dashboard.
        'paypal' => [
            'driver' => PaypalGateway::class,
            'client_id' => env('PAYPAL_CLIENT_ID'),
            'secret' => env('PAYPAL_CLIENT_SECRET'),
            'webhook_id' => env('PAYPAL_WEBHOOK_ID'),
            'sandbox' => env('PAYPAL_SANDBOX', true),
            'return_url' => env('PAYPAL_RETURN_URL', '/checkout/return/paypal'),
            'cancel_return_url' => env('PAYPAL_CANCEL_RETURN_URL', '/checkout/cancel/paypal'),
        ],
        'tabby' => [
            'driver' => TabbyGateway::class,
            'secret_key' => env('TABBY_SECRET_KEY'),
            'merchant_code' => env('TABBY_MERCHANT_CODE'),
            'base_url' => env('TABBY_BASE_URL', 'https://api.tabby.ai'),
            'webhook_key' => env('TABBY_WEBHOOK_KEY'),
            'return_url' => env('TABBY_RETURN_URL', '/checkout/return/tabby'),
            'cancel_return_url' => env('TABBY_CANCEL_RETURN_URL', '/checkout/cancel/tabby'),
        ],
        'tamara' => [
            'driver' => TamaraGateway::class,
            'api_token' => env('TAMARA_API_TOKEN'),
            'notification_token' => env('TAMARA_NOTIFICATION_TOKEN'),
            'base_url' => env('TAMARA_BASE_URL', 'https://api-sandbox.tamara.co'),
            'return_url' => env('TAMARA_RETURN_URL', '/checkout/return/tamara'),
            'cancel_return_url' => env('TAMARA_CANCEL_RETURN_URL', '/checkout/cancel/tamara'),
        ],
        'fake' => [
            'driver' => FakeGateway::class,
            'return_url' => env('FAKE_RETURN_URL', '/checkout/return/fake'),
            'cancel_return_url' => env('FAKE_CANCEL_RETURN_URL', '/checkout/cancel/fake'),
        ],
    ],
];
