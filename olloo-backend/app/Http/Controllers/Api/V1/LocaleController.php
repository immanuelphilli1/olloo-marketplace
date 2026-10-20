<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Currency\ShopperLocale;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

/**
 * The country we placed the shopper in and the currency prices, carts and
 * orders use for them. Send the same `?country=` here as on other calls.
 *
 * A signed-in shopper can also set the country they prefer with
 * `PUT /users/me/country`, which beats their assigned country and their IP.
 */
final class LocaleController extends Controller
{
    public function show(ShopperLocale $locale): JsonResponse
    {
        return response()->json($locale->toArray());
    }
}
