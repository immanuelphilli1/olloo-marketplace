<?php

declare(strict_types=1);

namespace App\Shipping;

use App\Models\Address;
use App\Models\Country;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Where the shopper is shipping to, for delivery info on product pages:
 * `?country=` (ISO code, rid or name), else the signed-in customer's default
 * address. NULL means unknown, and then no delivery claims are shown.
 */
final class DeliveryDestination
{
    public static function fromRequest(Request $request): ?string
    {
        $requested = trim((string) $request->query('country', ''));
        if ($requested !== '') {
            $country = Country::resolve($requested);
            if (! $country instanceof Country) {
                abort(api_error('country_not_found', 'Unknown country. Send an ISO code such as AE.', 422));
            }

            return $country->code;
        }

        $user = $request->user();

        return $user instanceof User ? self::forUser($user) : null;
    }

    public static function forUser(User $user): ?string
    {
        $address = Address::query()
            ->where('user_id', $user->id)
            ->orderByDesc('is_default')
            ->orderByDesc('id')
            ->with('country')
            ->first();

        return $address?->country->code;
    }
}
