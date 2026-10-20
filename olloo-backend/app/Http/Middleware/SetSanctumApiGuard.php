<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Make sanctum the default guard for every API request.
 *
 * Guest-capable routes (cart, checkout preview, browsing history) carry no
 * auth:sanctum middleware so guests are not rejected. Without this,
 * $request->user() only consults the web (session) guard and a valid Bearer
 * token resolves to null. After this middleware, $request->user() is the
 * sanctum user when a token is present and null for guests. No call site
 * needs a guard fallback.
 */
final class SetSanctumApiGuard
{
    public function handle(Request $request, Closure $next): Response
    {
        Auth::shouldUse('sanctum');

        return $next($request);
    }
}
