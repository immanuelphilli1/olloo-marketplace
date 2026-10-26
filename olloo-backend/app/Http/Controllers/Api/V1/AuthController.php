<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Country;
use App\Models\User;
use App\Models\UserSetting;
use App\Services\AuthTokenService;
use App\Services\CartService;
use App\Services\GoogleOAuthService;
use App\Support\GhanaPhone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

final class AuthController extends Controller
{
    public function __construct(
        private readonly AuthTokenService $tokens,
        private readonly CartService $carts,
        private readonly GoogleOAuthService $google,
    ) {}

    public function checkEmail(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $user = User::query()
            ->where('email', $data['email'])
            ->where('is_guest', false)
            ->first();

        if ($user === null) {
            return response()->json(['exists' => false, 'nextStep' => 'register']);
        }

        if ($user->password === null && $user->oauth_provider !== null) {
            return response()->json([
                'exists' => true,
                'nextStep' => 'oauth',
                'oauthProvider' => $user->oauth_provider,
            ]);
        }

        return response()->json(['exists' => true, 'nextStep' => 'password']);
    }

    /**
     * Phone counterpart of `checkEmail`: tells the storefront whether to ask for
     * a password or start registration. The number is normalised first, so
     * `0241234567` and `+233 24 123 4567` find the same account.
     */
    public function checkPhone(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone' => ['required', 'string', 'max:20'],
        ]);

        $phone = $this->normalizedPhoneOrFail($data['phone']);

        $exists = User::query()
            ->where('login_phone', $phone)
            ->where('is_guest', false)
            ->exists();

        return response()->json([
            'exists' => $exists,
            'nextStep' => $exists ? 'password' : 'register',
            'phone' => $phone,
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', Rule::unique('users', 'email')->withoutTrashed()],
            // Optional so existing email-only clients keep working; the storefront
            // always sends it.
            'phone' => ['nullable', 'string', 'max:20'],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
            'fullName' => ['required', 'string', 'max:120'],
            'displayName' => ['nullable', 'string', 'max:60'],
            // Country of residence. Becomes the shopper's preferred_country, so
            // the first page after signup is already in their market.
            'country' => ['required', 'string', 'max:120'],
        ]);

        $phone = null;
        if (filled($data['phone'] ?? null)) {
            $phone = $this->normalizedPhoneOrFail($data['phone']);

            // Checked against the normalised value, which a `unique` rule on the
            // raw input would miss (`024...` vs `+23324...`).
            if (User::query()->where('login_phone', $phone)->exists()) {
                throw ValidationException::withMessages([
                    'phone' => ['An account already uses this phone number. Sign in instead.'],
                ]);
            }
        }

        $country = Country::resolve($data['country']);
        if (! $country instanceof Country) {
            return api_error('country_not_found', 'Unknown country. Send an ISO code such as GH.', 422);
        }

        $user = User::query()->create([
            'name' => $data['fullName'],
            'display_name' => $data['displayName'] ?? explode(' ', $data['fullName'])[0],
            'email' => $data['email'],
            'login_phone' => $phone,
            // Also the contact number shown on the profile.
            'phone' => $phone,
            'password' => $data['password'],
            'user_type' => 'customer',
            'email_verified_at' => now(),
        ]);

        UserSetting::put($user->id, UserSetting::PREFERRED_COUNTRY, $country->code);

        $payload = $this->tokens->issueTokens($user);
        $this->carts->mergeGuestCartIfPresent($request, $user);

        return response()->json($payload, 201);
    }

    /** Signs in with `email` or `phone` (a Ghana mobile number) plus the password. */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required_without:phone', 'nullable', 'email'],
            'phone' => ['required_without:email', 'nullable', 'string', 'max:20'],
            'password' => ['required', 'string'],
        ]);

        $field = filled($data['phone'] ?? null) ? 'phone' : 'email';
        $user = $field === 'phone'
            ? User::query()->where('login_phone', $this->normalizedPhoneOrFail($data['phone']))->first()
            : User::query()->where('email', $data['email'])->first();

        if (! $user || ! $user->password || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                $field => ['The provided credentials are incorrect.'],
            ]);
        }

        $payload = $this->tokens->issueTokens($user);
        $this->carts->mergeGuestCartIfPresent($request, $user);

        return response()->json($payload);
    }

    private function normalizedPhoneOrFail(string $input): string
    {
        return GhanaPhone::normalize($input) ?? throw ValidationException::withMessages([
            'phone' => [GhanaPhone::INVALID_MESSAGE],
        ]);
    }

    public function oauthUrl(string $provider): JsonResponse
    {
        if ($provider !== 'google') {
            return api_error('unsupported_provider', 'Unsupported OAuth provider.', 422);
        }

        return response()->json($this->google->authorizationUrl());
    }

    public function oauth(Request $request, string $provider): JsonResponse
    {
        if ($provider !== 'google') {
            return api_error('unsupported_provider', 'Unsupported OAuth provider.', 422);
        }

        $data = $request->validate([
            'code' => ['required', 'string'],
            'state' => ['required', 'string'],
        ]);

        if (! $this->google->isValidState($data['state'])) {
            return api_error('oauth_invalid_state', 'The sign-in session expired or is invalid. Please try again.', 422);
        }

        $profile = $this->google->userFromCode($data['code']);
        if ($profile === null) {
            return api_error('oauth_failed', 'Google sign-in failed. Please try again.', 401);
        }

        if (! $profile['email_verified']) {
            return api_error('oauth_email_unverified', 'Your Google email address is not verified.', 422);
        }

        $user = User::query()
            ->where('oauth_provider', 'google')
            ->where('oauth_provider_id', $profile['sub'])
            ->first();

        if ($user === null) {
            $user = User::query()->whereRaw('LOWER(email) = ?', [Str::lower($profile['email'])])->first();

            if ($user !== null && $user->oauth_provider !== null) {
                return api_error('oauth_account_conflict', 'This email is already linked to another sign-in method.', 409);
            }
        }

        if ($user === null) {
            $name = $profile['name'] ?? Str::before($profile['email'], '@');

            $user = User::query()->create([
                'name' => $name,
                'display_name' => $profile['given_name'] ?? explode(' ', $name)[0],
                'email' => $profile['email'],
                'user_type' => 'customer',
                'email_verified_at' => now(),
                'password' => null,
                'oauth_provider' => 'google',
                'oauth_provider_id' => $profile['sub'],
            ]);
        } elseif ($user->oauth_provider === null) {
            $user->forceFill([
                'oauth_provider' => 'google',
                'oauth_provider_id' => $profile['sub'],
                'is_guest' => false,
                'email_verified_at' => $user->email_verified_at ?? now(),
            ])->save();
        }

        $payload = $this->tokens->issueTokens($user);
        $this->carts->mergeGuestCartIfPresent($request, $user);

        return response()->json($payload);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $request->user()->toAuthArray(),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $this->tokens->revokeAccessToken($request->user());

        return response()->json(['success' => true]);
    }

    public function refresh(Request $request): JsonResponse
    {
        $data = $request->validate([
            'refreshToken' => ['required', 'string'],
        ]);

        return response()->json($this->tokens->refresh($data['refreshToken']));
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email']]);

        Password::sendResetLink(['email' => $data['email']]);

        return response()->json([
            'message' => 'If that email exists, a reset link has been sent.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'string'],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
        ]);

        $status = Password::reset(
            [
                'email' => $data['email'],
                'password' => $data['password'],
                'password_confirmation' => $data['password'],
                'token' => $data['token'],
            ],
            function (User $user, string $password): void {
                $user->forceFill(['password' => $password])->save();
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            return api_error('reset_failed', __($status), 422);
        }

        return response()->json(['message' => 'Password has been reset.']);
    }
}
