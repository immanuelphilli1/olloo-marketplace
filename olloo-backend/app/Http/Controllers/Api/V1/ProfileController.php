<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Currency\ShopperLocale;
use App\Http\Controllers\Controller;
use App\Models\Country;
use App\Models\User;
use App\Models\UserSetting;
use App\Services\AuthTokenService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;
use PragmaRX\Google2FA\Google2FA;

final class ProfileController extends Controller
{
    public function __construct(
        private readonly AuthTokenService $tokens,
        private readonly Google2FA $google2fa = new Google2FA,
    ) {}

    public function show(Request $request): JsonResponse
    {
        return response()->json($this->profilePayload($request->user()));
    }

    /**
     * The country this shopper wants to shop in, which wins over the country we
     * assigned them from their IP. Null clears it and puts them back on their
     * assigned country (or their IP, if they have neither).
     *
     * Answers with the locale that results, so a client can re-render prices
     * from this one response instead of guessing and refetching.
     */
    public function updateCountry(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'preferredCountry' => ['present', 'nullable', 'string', 'max:120'],
        ]);

        $preferred = $data['preferredCountry'];

        if ($preferred !== null) {
            $country = Country::resolve($preferred);
            if (! $country instanceof Country) {
                return api_error('country_not_found', 'Unknown country. Send an ISO code such as GH.', 422);
            }

            UserSetting::put($user->id, UserSetting::PREFERRED_COUNTRY, $country->code);
        } else {
            UserSetting::put($user->id, UserSetting::PREFERRED_COUNTRY, null);
        }

        // The locale is resolved once per request, so it still holds the old
        // answer. Forget it to force the new preference to be read back.
        app(ShopperLocale::class)->forget();

        return response()->json(app(ShopperLocale::class)->toArray());
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'fullName' => ['sometimes', 'string', 'max:120'],
            'displayName' => ['sometimes', 'nullable', 'string', 'max:60'],
            'avatar' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);

        if (array_key_exists('fullName', $data)) {
            $user->name = $data['fullName'];
        }

        if (array_key_exists('displayName', $data)) {
            $user->display_name = $data['displayName'];
        }

        if (array_key_exists('avatar', $data)) {
            $user->avatar_path = $data['avatar'];
        }

        $user->save();

        return response()->json($this->profilePayload($user->fresh()));
    }

    public function security(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'email' => $user->email,
            'phone' => $user->phone,
            'twoFactorEnabled' => (bool) $user->two_factor_enabled,
        ]);
    }

    public function updateEmail(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($user->id)->withoutTrashed(),
            ],
            'password' => ['required', 'string'],
        ]);

        if (! $user->password || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'password' => ['The provided password is incorrect.'],
            ]);
        }

        $user->email = $data['email'];
        $user->email_verified_at = null;
        $user->save();

        return response()->json($this->profilePayload($user->fresh()));
    }

    public function updatePhone(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'phone' => ['nullable', 'string', 'max:40'],
        ]);

        $user->phone = $data['phone'] ?? null;
        $user->save();

        return response()->json([
            'email' => $user->email,
            'phone' => $user->phone,
            'twoFactorEnabled' => (bool) $user->two_factor_enabled,
        ]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'currentPassword' => ['required', 'string'],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
        ]);

        if (! $user->password || ! Hash::check($data['currentPassword'], $user->password)) {
            throw ValidationException::withMessages([
                'currentPassword' => ['The provided password is incorrect.'],
            ]);
        }

        $user->password = $data['password'];
        $user->save();

        return response()->json(['success' => true]);
    }

    public function enableTwoFactor(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->two_factor_enabled && $user->two_factor_secret) {
            return api_error('two_factor_already_enabled', 'Two-factor authentication is already enabled.', 422);
        }

        $secret = $this->google2fa->generateSecretKey();
        $issuer = (string) config('app.name', 'HandCO');
        $otpauthUrl = $this->google2fa->getQRCodeUrl($issuer, (string) $user->email, $secret);

        $user->forceFill([
            'two_factor_secret' => $secret,
            'two_factor_enabled' => true,
        ])->save();

        return response()->json([
            'enabled' => true,
            'secret' => $secret,
            'otpauthUrl' => $otpauthUrl,
        ]);
    }

    public function disableTwoFactor(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'password' => ['required', 'string'],
        ]);

        if (! $user->password || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'password' => ['The provided password is incorrect.'],
            ]);
        }

        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_enabled' => false,
        ])->save();

        return response()->json([
            'enabled' => false,
            'success' => true,
        ]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'password' => ['required', 'string'],
        ]);

        if (! $user->password || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'password' => ['The provided password is incorrect.'],
            ]);
        }

        $this->tokens->revokeAccessToken($user);
        $this->tokens->revokeAllRefreshTokens($user);

        $user->tokens()->delete();
        // Soft delete: the account closes and can no longer sign in, but its
        // orders, payments and reviews keep their owner for records.
        $user->delete();

        return response()->json(['success' => true]);
    }

    /**
     * @return array{fullName: string, email: string, initials: string, displayName: string, phone: ?string, rid: string}
     */
    private function profilePayload(User $user): array
    {
        return [
            'fullName' => $user->name,
            'email' => $user->email,
            'initials' => $this->initials($user->name),
            'displayName' => $user->display_name ?: explode(' ', $user->name)[0],
            'phone' => $user->phone,
            'rid' => $user->rid,
            // ISO code the shopper chose (signup or PUT /users/me/country), or null.
            'preferredCountry' => UserSetting::valueFor($user->id, UserSetting::PREFERRED_COUNTRY),
        ];
    }

    private function initials(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name)) ?: [];
        $parts = array_values(array_filter($parts, static fn (string $part): bool => $part !== ''));

        if ($parts === []) {
            return '?';
        }

        $letters = array_map(
            static fn (string $part): string => mb_strtoupper(mb_substr($part, 0, 1)),
            array_slice($parts, 0, 2),
        );

        return implode('', $letters);
    }
}
