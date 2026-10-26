<?php

declare(strict_types=1);

return [

    /*
    | A rate older than this is never used: the shopper sees the default
    | currency until `currency:update-rates` succeeds again.
    */
    'max_rate_age_hours' => (int) env('CURRENCY_MAX_RATE_AGE_HOURS', 36),

    /*
    | Markup added on top of the mid-market rate (percent) until staff save one
    | on the admin Currencies page. Per-pair overrides win over both.
    */
    'default_markup_percent' => (float) env('CURRENCY_DEFAULT_MARKUP_PERCENT', 0),

    /*
    | ISO code of the market a shopper lands in when nothing places them (no
    | ?country=, no stored country, no usable IP: localhost, VPNs, a blank
    | IPINFO_TOKEN). Blank keeps the default currency's own country. A
    | Ghana-first store sets GH so unplaced visitors see GHS, not USD.
    */
    'fallback_country' => env('SHOPPER_FALLBACK_COUNTRY') ?: null,

    'geoip' => [
        // Country per IP is cached, so each visitor IP costs one lookup per TTL.
        'hit_ttl_hours' => (int) env('GEOIP_HIT_TTL_HOURS', 24),
        // IPs the provider could not place (VPNs, satellite) are retried after this.
        'miss_ttl_minutes' => (int) env('GEOIP_MISS_TTL_MINUTES', 60),
        // After a provider error or rate limit, skip lookups for this long.
        'backoff_minutes' => (int) env('GEOIP_BACKOFF_MINUTES', 5),
        'timeout_seconds' => (int) env('GEOIP_TIMEOUT_SECONDS', 3),
    ],

];
