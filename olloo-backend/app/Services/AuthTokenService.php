<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\RefreshToken;
use App\Models\User;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

final class AuthTokenService
{
    public function issueTokens(User $user): array
    {
        $access = $user->createToken('access');
        $refreshPlain = Str::random(64);

        RefreshToken::query()->create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $refreshPlain),
            'expires_at' => now()->addDays(30),
        ]);

        return [
            'user' => $user->toAuthArray(),
            'accessToken' => $access->plainTextToken,
            'refreshToken' => $refreshPlain,
        ];
    }

    public function refresh(string $refreshToken): array
    {
        $hash = hash('sha256', $refreshToken);
        $record = RefreshToken::query()
            ->where('token_hash', $hash)
            ->whereNull('revoked_at')
            ->where('expires_at', '>', now())
            ->first();

        if (! $record) {
            throw new HttpException(
                401,
                'Invalid or expired refresh token.'
            );
        }

        $record->update(['revoked_at' => now()]);
        $user = $record->user;

        $user->tokens()->where('name', 'access')->delete();

        return $this->issueTokens($user);
    }

    public function revokeAccessToken(User $user): void
    {
        $token = $user->currentAccessToken();
        if ($token) {
            $token->delete();
        }
    }

    public function revokeAllRefreshTokens(User $user): void
    {
        $user->refreshTokens()->whereNull('revoked_at')->update(['revoked_at' => now()]);
    }
}
