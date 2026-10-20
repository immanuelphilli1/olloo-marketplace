<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureStaffMfaVerified
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user('staff');

        if ($user === null || ! config('admin.mfa_forced')) {
            return $next($request);
        }

        if (empty($user->two_factor_secret)) {
            return redirect()->route('admin.mfa.setup');
        }

        if ($user->two_factor_enabled && ! $request->session()->get('staff_mfa_verified')) {
            return redirect()->route('admin.mfa.verify');
        }

        return $next($request);
    }
}
