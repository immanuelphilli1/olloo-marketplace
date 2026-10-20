<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Guards configuration whose failure would be silent or confusing rather than
 * loud, in the places where the symptom appears far from the cause.
 */
final class EnvGuard
{
    /**
     * The admin prefix is both an obscurity and a URL segment, so a value that
     * looks usable but breaks routing has to be rejected at boot.
     *
     * The gateway templates this same variable into `location ^~ /<prefix>/`. An
     * empty value yields `location ^~ //`, which nginx refuses to parse, so the
     * container dies with "invalid number of arguments in location" and points at
     * nginx rather than at app.env. Failing here names the file and the key.
     */
    public static function adminPathPrefix(string $prefix): string
    {
        $trimmed = trim($prefix);

        if ($trimmed === '') {
            throw new \RuntimeException(
                'ADMIN_PATH_PREFIX is empty, so the staff portal would mount at the site root. '
                .'Set it in the container env file; the gateway needs the same value, or it will not start. '
                .'Unset it entirely to use the default in config/admin.php.'
            );
        }

        // nginx location prefixes are path segments. A leading slash, a trailing
        // slash or a slash inside would produce a directive that parses but never
        // matches, which looks like a 404 on every admin URL.
        if (str_starts_with($trimmed, '/') || str_starts_with($trimmed, '-')) {
            throw new \RuntimeException(
                "ADMIN_PATH_PREFIX must not start with '/' or '-': got '{$trimmed}'. Use a bare path segment."
            );
        }

        if (str_ends_with($trimmed, '/')) {
            throw new \RuntimeException(
                "ADMIN_PATH_PREFIX must not end with '/': got '{$trimmed}'."
            );
        }

        if (str_contains($trimmed, '/')) {
            throw new \RuntimeException(
                "ADMIN_PATH_PREFIX must be a single path segment, not a path: got '{$trimmed}'."
            );
        }

        return $trimmed;
    }
}
