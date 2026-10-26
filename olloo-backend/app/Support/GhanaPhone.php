<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Ghana mobile numbers for phone sign-in.
 *
 * Shoppers type numbers every way (`024 123 4567`, `0241234567`, `+233 24 123
 * 4567`, `233241234567`, `24 123 4567`), so every entry point normalises to
 * E.164 (`+233241234567`) before storing or looking up. One canonical form is
 * what lets `users.login_phone` be unique.
 */
final class GhanaPhone
{
    /**
     * Mobile network codes, the two digits after the leading 0 (MTN, Telecel,
     * AirtelTigo, Glo, Expresso). Landline codes such as 030 are rejected:
     * sign-in numbers must be able to receive a text once SMS codes are added.
     */
    private const MOBILE_PREFIXES = ['20', '23', '24', '25', '26', '27', '28', '50', '53', '54', '55', '56', '57', '59'];

    public const INVALID_MESSAGE = 'Enter a valid Ghana mobile number, such as 024 123 4567.';

    /** Returns the number as `+233XXXXXXXXX`, or null when it is not a Ghana mobile number. */
    public static function normalize(string $input): ?string
    {
        $digits = preg_replace('/\D+/', '', $input) ?? '';

        $national = match (true) {
            strlen($digits) === 9 => $digits,
            strlen($digits) === 10 && str_starts_with($digits, '0') => substr($digits, 1),
            strlen($digits) === 12 && str_starts_with($digits, '233') => substr($digits, 3),
            strlen($digits) === 14 && str_starts_with($digits, '00233') => substr($digits, 5),
            default => null,
        };

        if ($national === null || ! in_array(substr($national, 0, 2), self::MOBILE_PREFIXES, true)) {
            return null;
        }

        return '+233'.$national;
    }
}
