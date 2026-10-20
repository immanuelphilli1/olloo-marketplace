<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use PragmaRX\Google2FA\Google2FA;

class MfaController extends Controller
{
    public function __construct(
        private readonly Google2FA $google2fa,
    ) {}

    public function showSetup(Request $request): Response|RedirectResponse
    {
        $user = $request->user('staff');

        if ($user->two_factor_enabled && ! empty($user->two_factor_secret)) {
            return redirect()->route('admin.mfa.verify');
        }

        $secret = $request->session()->get('staff_mfa_pending_secret');

        if (! is_string($secret) || $secret === '') {
            $secret = $this->google2fa->generateSecretKey();
            $request->session()->put('staff_mfa_pending_secret', $secret);
        }

        $otpauthUrl = $this->google2fa->getQRCodeUrl(
            config('app.name', 'HandCO'),
            $user->email,
            $secret,
        );

        return Inertia::render('Admin/Auth/Mfa', [
            'mode' => 'setup',
            'secret' => $secret,
            'otpauthUrl' => $otpauthUrl,
        ]);
    }

    public function storeSetup(Request $request): RedirectResponse
    {
        $user = $request->user('staff');

        $validated = $request->validate([
            'code' => ['required', 'string', 'size:6'],
        ]);

        $secret = $request->session()->get('staff_mfa_pending_secret');

        if (! is_string($secret) || $secret === '') {
            return redirect()->route('admin.mfa.setup')
                ->with('error', 'MFA setup expired. Please try again.');
        }

        $valid = $this->google2fa->verifyKey($secret, $validated['code']);

        if (! $valid) {
            throw ValidationException::withMessages([
                'code' => 'Invalid authentication code.',
            ]);
        }

        $user->forceFill([
            'two_factor_secret' => $secret,
            'two_factor_enabled' => true,
        ])->save();

        $request->session()->forget('staff_mfa_pending_secret');
        $request->session()->put('staff_mfa_verified', true);

        return redirect()->route('admin.dashboard');
    }

    public function showVerify(Request $request): Response|RedirectResponse
    {
        $user = $request->user('staff');

        if (empty($user->two_factor_secret)) {
            return redirect()->route('admin.mfa.setup');
        }

        if ($request->session()->get('staff_mfa_verified')) {
            return redirect()->route('admin.dashboard');
        }

        return Inertia::render('Admin/Auth/Mfa', [
            'mode' => 'verify',
            'secret' => null,
            'otpauthUrl' => null,
        ]);
    }

    public function storeVerify(Request $request): RedirectResponse
    {
        $user = $request->user('staff');

        $validated = $request->validate([
            'code' => ['required', 'string', 'size:6'],
        ]);

        if (empty($user->two_factor_secret)) {
            return redirect()->route('admin.mfa.setup');
        }

        $valid = $this->google2fa->verifyKey($user->two_factor_secret, $validated['code']);

        if (! $valid) {
            throw ValidationException::withMessages([
                'code' => 'Invalid authentication code.',
            ]);
        }

        $request->session()->put('staff_mfa_verified', true);

        return redirect()->route('admin.dashboard');
    }
}
