<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureStaffPasswordChanged
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user('staff');

        if ($user !== null && $user->must_change_password) {
            return redirect()->route('admin.password.force');
        }

        return $next($request);
    }
}
