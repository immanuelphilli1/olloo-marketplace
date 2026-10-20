<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Google OAuth 2.0 authorization-code flow for the storefront API.
 *
 * The web client redirects to {@see authorizationUrl()}, Google sends the user back to
 * GOOGLE_OAUTH_REDIRECT_URL (a web client page) with `code` + `state`, and the client posts
 * both to the API, which exchanges the code here. `state` is encrypted and time-boxed so the
 * API can verify it issued it without a session.
 */
final class GoogleOAuthService
{
    private const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

    private const TOKEN_URL = 'https://oauth2.googleapis.com/token';

    private const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

    private const STATE_TTL_MINUTES = 10;

    public function __construct(private readonly ExternalRequestLogger $logger) {}

    /**
     * @return array{url: string, state: string}
     */
    public function authorizationUrl(): array
    {
        $config = $this->config();

        $state = Crypt::encryptString((string) json_encode([
            'nonce' => Str::random(32),
            'exp' => now()->addMinutes(self::STATE_TTL_MINUTES)->getTimestamp(),
        ]));

        $url = self::AUTHORIZE_URL.'?'.http_build_query([
            'client_id' => $config['client_id'],
            'redirect_uri' => $config['redirect'],
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            'prompt' => 'select_account',
        ]);

        return ['url' => $url, 'state' => $state];
    }

    public function isValidState(string $state): bool
    {
        try {
            $payload = json_decode(Crypt::decryptString($state), true);
        } catch (DecryptException) {
            return false;
        }

        return is_array($payload)
            && is_int($payload['exp'] ?? null)
            && $payload['exp'] >= now()->getTimestamp();
    }

    /**
     * Exchange an authorization code for the Google profile. Null when Google rejects the
     * code or returns a profile without `sub`/`email`.
     *
     * @return array{sub: string, email: string, email_verified: bool, name: string|null, given_name: string|null}|null
     */
    public function userFromCode(string $code): ?array
    {
        $config = $this->config();

        $token = $this->send('token_exchange', 'POST', self::TOKEN_URL, fn () => Http::asForm()
            ->acceptJson()
            ->timeout(10)
            ->post(self::TOKEN_URL, [
                'code' => $code,
                'client_id' => $config['client_id'],
                'client_secret' => $config['client_secret'],
                'redirect_uri' => $config['redirect'],
                'grant_type' => 'authorization_code',
            ]), ['code' => '***redacted***', 'grant_type' => 'authorization_code']);

        $accessToken = $token?->json('access_token');
        if (! is_string($accessToken) || $accessToken === '') {
            return null;
        }

        $profile = $this->send('userinfo', 'GET', self::USERINFO_URL, fn () => Http::withToken($accessToken)
            ->acceptJson()
            ->timeout(10)
            ->get(self::USERINFO_URL));

        $sub = $profile?->json('sub');
        $email = $profile?->json('email');
        if (! is_string($sub) || $sub === '' || ! is_string($email) || $email === '') {
            return null;
        }

        return [
            'sub' => $sub,
            'email' => $email,
            'email_verified' => $profile->json('email_verified') === true,
            'name' => is_string($profile->json('name')) ? $profile->json('name') : null,
            'given_name' => is_string($profile->json('given_name')) ? $profile->json('given_name') : null,
        ];
    }

    /**
     * @param  callable(): Response  $call
     * @param  array<string, mixed>|null  $loggedBody
     */
    private function send(string $action, string $method, string $url, callable $call, ?array $loggedBody = null): ?Response
    {
        $response = null;
        $exception = null;
        $startedAt = microtime(true);

        try {
            $response = $call();
        } catch (\Throwable $e) {
            $exception = $e;
        } finally {
            $this->logger->logOutgoing([
                'service' => 'google_oauth',
                'action' => $action,
                'request' => ['method' => $method, 'url' => $url, 'body' => $loggedBody],
                'response' => $response ? [
                    'status_code' => $response->status(),
                    'body' => is_array($response->json())
                        ? Arr::except($response->json(), ['access_token', 'id_token', 'refresh_token'])
                        : $response->body(),
                ] : null,
                'exception' => $exception,
                'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
            ]);
        }

        return $response?->successful() ? $response : null;
    }

    /**
     * @return array{client_id: string, client_secret: string, redirect: string}
     */
    private function config(): array
    {
        $config = (array) config('services.google');

        foreach (['client_id', 'client_secret', 'redirect'] as $key) {
            if (! is_string($config[$key] ?? null) || $config[$key] === '') {
                throw new \RuntimeException("Google OAuth is not configured: services.google.{$key} is missing.");
            }
        }

        return $config;
    }
}
