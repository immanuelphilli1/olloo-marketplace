<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'restcountries' => [
        'api_key' => env('RESTCOUNTRIES_API_KEY'),
        'base_url' => env('RESTCOUNTRIES_BASE_URL', 'https://api.restcountries.com/countries/v5'),
    ],

    // Daily FX rates for `currency:update-rates`. Blank key uses the keyless
    // open.er-api.com endpoint (same provider, lower rate limit).
    'exchange_rate' => [
        'api_key' => env('EXCHANGE_RATE_API_KEY') ?: null,
    ],

    // IP to country for the shopper's currency (ipinfo Lite, free for
    // commercial use). Blank token turns the lookup off.
    'ipinfo' => [
        'token' => env('IPINFO_TOKEN') ?: null,
        'base_url' => (string) env('IPINFO_BASE_URL', 'https://api.ipinfo.io/lite'),
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_OAUTH_REDIRECT_URL'),
    ],

    /*
    | Storefront (the separate web client). Payment gateways return here rather
    | than to a page we host: /checkout/return/{provider} verifies the payment
    | with the provider, then bounces the shopper back to the storefront to
    | render the result. Must be an absolute http(s) URL, never inferred.
    */
    'storefront' => [
        'url' => env('WEB_CLIENT_URL'),
        'return_path' => env('WEB_CLIENT_RETURN_PATH', '/checkout/return'),
        'cancel_path' => env('WEB_CLIENT_CANCEL_PATH', '/checkout/cancel'),
        // The published storefront build, mounted read-only into the app
        // container. Home, category and product pages are served from it with
        // their meta tags filled in, so crawlers and link previews need no JS.
        'index_path' => (string) env('STOREFRONT_INDEX_PATH', '/var/www/html/web/current/index.html'),
        'site_name' => (string) env('STOREFRONT_SITE_NAME', 'olloo'),
        'description' => (string) env('STOREFRONT_DESCRIPTION', 'Shop electronics, fashion, home and more on olloo, with secure checkout and tracked delivery.'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
