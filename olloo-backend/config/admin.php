<?php

declare(strict_types=1);

return [
    /*
     * The staff portal is mounted under this prefix and the prefix is the only
     * obscurity in front of it, so it must not resolve to "" or "/".
     *
     * env()'s second argument only applies when the variable is MISSING, not when
     * it is present and empty. `ADMIN_PATH_PREFIX=` therefore yields "", which
     * mounts the admin at the site root, and an empty value in the gateway's
     * environment produces `location ^~ //`, which nginx rejects outright and
     * the gateway refuses to start. ValidateAdminPathPrefix fails on exactly
     * that instead of on a confusing nginx error.
     */
    'path_prefix' => env('ADMIN_PATH_PREFIX', 'x7k9mPq2vL5nJw'),
    'mfa_forced' => (bool) env('ADMIN_MFA_FORCED', true),

    /**
     * Rows per page on every admin list, so the same screen length and the
     * same Paginator appear everywhere. Wide tables (webhooks, request history)
     * scroll horizontally rather than dropping to a smaller page, because a
     * short page there means more round trips, not a shorter screen.
     */
    'per_page' => (int) env('ADMIN_PER_PAGE', 50),
];
