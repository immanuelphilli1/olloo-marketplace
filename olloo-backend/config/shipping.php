<?php

declare(strict_types=1);

return [
    'fee_minor' => (int) env('SHIPPING_FEE_MINOR', 2000),
    'courier_label' => env('SHIPPING_COURIER_LABEL', 'Courier company:'),
    // Business days before dispatch for variants without their own handling time.
    'default_handling_days' => (int) env('SHIPPING_DEFAULT_HANDLING_DAYS', 1),

    /**
     * Only read by the 2026_10_03 delivery backfill, which had to copy the
     * day range the old free-text delivery copy promised. It lives here so the
     * migration never calls env() itself: under config:cache env() returns
     * null outside config files, which would have silently backfilled 3-5
     * instead of whatever this site had actually promised.
     */
    'legacy_delivery_window' => env('SHIPPING_DELIVERY_WINDOW', 'Delivery: 3-5 business days'),
];
