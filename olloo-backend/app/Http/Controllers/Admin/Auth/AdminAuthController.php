<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AdminAuthController extends Controller
{
    public function showLogin(): Response
    {
        return Inertia::render('Admin/Auth/Login');
    }

    public function login(Request $request): RedirectResponse|\Symfony\Component\HttpFoundation\Response
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::guard('staff')->attempt($credentials, $request->boolean('remember'))) {
            throw ValidationException::withMessages([
                'email' => 'These credentials do not match our records.',
            ]);
        }

        $user = Auth::guard('staff')->user();

        if ($user === null || ! $user->isStaff()) {
            Auth::guard('staff')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            throw ValidationException::withMessages([
                'email' => 'Staff access only.',
            ]);
        }

        $request->session()->regenerate();
        $request->session()->forget('staff_mfa_verified');

        return Inertia::location(route('admin.dashboard'));
    }

    public function logout(Request $request): \Symfony\Component\HttpFoundation\Response
    {
        Auth::guard('staff')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return Inertia::location(route('admin.login'));
    }

    public function showForcePassword(): Response
    {
        return Inertia::render('Admin/Auth/ForcePassword');
    }

    public function updateForcePassword(Request $request): RedirectResponse
    {
        $user = $request->user('staff');

        $validated = $request->validate([
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        $user->forceFill([
            'password' => $validated['password'],
            'must_change_password' => false,
        ])->save();

        return redirect()->route('admin.dashboard');
    }
}
