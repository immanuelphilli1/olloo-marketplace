<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\ExternalRequestLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

final class GoogleOAuthApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.google.client_id' => 'client-123',
            'services.google.client_secret' => 'secret-456',
            'services.google.redirect' => 'https://shop.test/oauth/google/callback',
        ]);
    }

    public function test_url_endpoint_returns_google_consent_url_with_state(): void
    {
        $response = $this->getJson(route('api.v1.auth.oauth.url', ['provider' => 'google']))
            ->assertOk()
            ->assertJsonStructure(['url', 'state']);

        $url = $response->json('url');
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);

        $this->assertStringStartsWith('https://accounts.google.com/o/oauth2/v2/auth?', $url);
        $this->assertSame('client-123', $query['client_id']);
        $this->assertSame('https://shop.test/oauth/google/callback', $query['redirect_uri']);
        $this->assertSame('code', $query['response_type']);
        $this->assertSame($response->json('state'), $query['state']);
    }

    public function test_unsupported_provider_is_rejected(): void
    {
        $this->getJson(route('api.v1.auth.oauth.url', ['provider' => 'facebook']))
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'unsupported_provider');
    }

    public function test_new_user_is_created_and_tokens_issued(): void
    {
        $this->fakeGoogle(['sub' => 'g-1', 'email' => 'Ada@Example.com', 'email_verified' => true, 'name' => 'Ada Lovelace', 'given_name' => 'Ada']);

        $response = $this->postJson(route('api.v1.auth.oauth', ['provider' => 'google']), [
            'code' => 'auth-code',
            'state' => $this->validState(),
        ])->assertOk()
            ->assertJsonStructure(['user' => ['rid', 'displayName', 'fullName', 'email'], 'accessToken', 'refreshToken'])
            ->assertJsonPath('user.fullName', 'Ada Lovelace')
            ->assertJsonPath('user.displayName', 'Ada');

        $user = User::query()->where('oauth_provider_id', 'g-1')->firstOrFail();
        $this->assertSame('google', $user->oauth_provider);
        $this->assertNull($user->password);
        $this->assertNotNull($user->email_verified_at);

        $this->withToken($response->json('accessToken'))
            ->getJson(route('api.v1.auth.me'))
            ->assertOk()
            ->assertJsonPath('user.rid', $user->rid);

        Http::assertSent(fn ($request) => $request->url() === 'https://oauth2.googleapis.com/token'
            && $request['code'] === 'auth-code'
            && $request['redirect_uri'] === 'https://shop.test/oauth/google/callback');

        $this->assertSame(2, ExternalRequestLog::query()->where('service', 'google_oauth')->count());
        $tokenLog = ExternalRequestLog::query()->where('action', 'token_exchange')->firstOrFail();
        $this->assertStringNotContainsString('google-access-token', (string) $tokenLog->response_body);
        $this->assertStringNotContainsString('auth-code', (string) $tokenLog->request_body);
    }

    public function test_returning_user_signs_in_without_duplicate(): void
    {
        $existing = User::factory()->create([
            'email' => 'ada@example.com',
            'user_type' => 'customer',
            'oauth_provider' => 'google',
            'oauth_provider_id' => 'g-1',
        ]);
        $this->fakeGoogle(['sub' => 'g-1', 'email' => 'ada@example.com', 'email_verified' => true]);

        $this->postJson(route('api.v1.auth.oauth', ['provider' => 'google']), [
            'code' => 'auth-code',
            'state' => $this->validState(),
        ])->assertOk()->assertJsonPath('user.rid', $existing->rid);

        $this->assertSame(1, User::query()->count());
    }

    public function test_existing_password_customer_is_linked_by_verified_email(): void
    {
        $existing = User::factory()->create([
            'email' => 'ada@example.com',
            'user_type' => 'customer',
        ]);
        $this->fakeGoogle(['sub' => 'g-9', 'email' => 'ADA@example.com', 'email_verified' => true]);

        $this->postJson(route('api.v1.auth.oauth', ['provider' => 'google']), [
            'code' => 'auth-code',
            'state' => $this->validState(),
        ])->assertOk()->assertJsonPath('user.rid', $existing->rid);

        $existing->refresh();
        $this->assertSame('google', $existing->oauth_provider);
        $this->assertSame('g-9', $existing->oauth_provider_id);
        $this->assertNotNull($existing->password);
    }

    public function test_unverified_google_email_is_rejected(): void
    {
        $this->fakeGoogle(['sub' => 'g-1', 'email' => 'ada@example.com', 'email_verified' => false]);

        $this->postJson(route('api.v1.auth.oauth', ['provider' => 'google']), [
            'code' => 'auth-code',
            'state' => $this->validState(),
        ])->assertStatus(422)->assertJsonPath('error.code', 'oauth_email_unverified');

        $this->assertSame(0, User::query()->count());
    }

    public function test_staff_email_signs_in_to_the_shop_with_google(): void
    {
        $staff = User::factory()->create(['email' => 'admin@example.com', 'user_type' => 'staff']);
        $this->fakeGoogle(['sub' => 'g-1', 'email' => 'admin@example.com', 'email_verified' => true]);

        $this->postJson(route('api.v1.auth.oauth', ['provider' => 'google']), [
            'code' => 'auth-code',
            'state' => $this->validState(),
        ])->assertOk()->assertJsonPath('user.rid', $staff->rid);

        $this->assertSame('staff', $staff->refresh()->user_type);
        $this->assertSame(1, User::query()->count());
    }

    public function test_email_linked_to_a_different_google_account_conflicts(): void
    {
        User::factory()->create([
            'email' => 'ada@example.com',
            'user_type' => 'customer',
            'oauth_provider' => 'google',
            'oauth_provider_id' => 'g-original',
        ]);
        $this->fakeGoogle(['sub' => 'g-other', 'email' => 'ada@example.com', 'email_verified' => true]);

        $this->postJson(route('api.v1.auth.oauth', ['provider' => 'google']), [
            'code' => 'auth-code',
            'state' => $this->validState(),
        ])->assertStatus(409)->assertJsonPath('error.code', 'oauth_account_conflict');
    }

    public function test_invalid_or_expired_state_is_rejected_before_calling_google(): void
    {
        Http::fake();

        $this->postJson(route('api.v1.auth.oauth', ['provider' => 'google']), [
            'code' => 'auth-code',
            'state' => 'tampered',
        ])->assertStatus(422)->assertJsonPath('error.code', 'oauth_invalid_state');

        $state = $this->validState();
        $this->travel(11)->minutes();

        $this->postJson(route('api.v1.auth.oauth', ['provider' => 'google']), [
            'code' => 'auth-code',
            'state' => $state,
        ])->assertStatus(422)->assertJsonPath('error.code', 'oauth_invalid_state');

        Http::assertNothingSent();
    }

    public function test_rejected_code_returns_oauth_failed_and_is_logged(): void
    {
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['error' => 'invalid_grant'], 400),
        ]);

        $this->postJson(route('api.v1.auth.oauth', ['provider' => 'google']), [
            'code' => 'used-code',
            'state' => $this->validState(),
        ])->assertStatus(401)->assertJsonPath('error.code', 'oauth_failed');

        $log = ExternalRequestLog::query()->where('action', 'token_exchange')->firstOrFail();
        $this->assertFalse((bool) $log->success);
        $this->assertSame(400, $log->status_code);
    }

    public function test_check_email_points_google_only_accounts_to_oauth(): void
    {
        User::factory()->create([
            'email' => 'ada@example.com',
            'user_type' => 'customer',
            'password' => null,
            'oauth_provider' => 'google',
            'oauth_provider_id' => 'g-1',
        ]);

        $this->postJson(route('api.v1.auth.check-email'), ['email' => 'ada@example.com'])
            ->assertOk()
            ->assertExactJson(['exists' => true, 'nextStep' => 'oauth', 'oauthProvider' => 'google']);
    }

    /**
     * @param  array<string, mixed>  $profile
     */
    private function fakeGoogle(array $profile): void
    {
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response([
                'access_token' => 'google-access-token',
                'id_token' => 'google-id-token',
                'token_type' => 'Bearer',
                'expires_in' => 3599,
            ]),
            'openidconnect.googleapis.com/v1/userinfo' => Http::response($profile),
        ]);
    }

    private function validState(): string
    {
        return $this->getJson(route('api.v1.auth.oauth.url', ['provider' => 'google']))->json('state');
    }
}
