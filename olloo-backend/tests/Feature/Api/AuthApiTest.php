<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Country;
use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_check_email_and_login_register_me(): void
    {
        Country::query()->create(['code' => 'GH', 'name' => 'Ghana']);

        $this->postJson('/api/v1/auth/check-email', ['email' => 'new@example.com'])
            ->assertOk()
            ->assertJson(['exists' => false, 'nextStep' => 'register']);

        $register = $this->postJson('/api/v1/auth/register', [
            'email' => 'new@example.com',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'fullName' => 'New User',
            'country' => 'GH',
        ])->assertCreated();

        $register->assertJsonStructure(['user' => ['rid', 'displayName', 'fullName', 'email'], 'accessToken', 'refreshToken']);
        $this->assertArrayNotHasKey('id', $register->json('user'));

        $token = $register->json('accessToken');

        $this->withToken($token)
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('user.email', 'new@example.com');

        $this->postJson('/api/v1/auth/login', [
            'email' => 'new@example.com',
            'password' => 'Password1!',
        ])->assertOk()->assertJsonStructure(['accessToken', 'refreshToken']);
    }

    public function test_register_stores_name_and_country_of_residence(): void
    {
        Country::query()->create(['code' => 'GH', 'name' => 'Ghana']);

        $this->postJson('/api/v1/auth/register', [
            'email' => 'ama@example.com',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'fullName' => 'Ama Mensah',
            'country' => 'gh',
        ])->assertCreated()
            ->assertJsonPath('user.fullName', 'Ama Mensah')
            ->assertJsonPath('user.displayName', 'Ama');

        $user = User::query()->where('email', 'ama@example.com')->firstOrFail();
        $this->assertSame('GH', UserSetting::valueFor($user->id, UserSetting::PREFERRED_COUNTRY));
    }

    public function test_register_rejects_a_missing_or_unknown_country_without_creating_the_user(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'email' => 'nobody@example.com',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'fullName' => 'No Body',
            'country' => 'Atlantis',
        ])->assertStatus(422)->assertJsonPath('error.code', 'country_not_found');

        $this->postJson('/api/v1/auth/register', [
            'email' => 'nobody@example.com',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'fullName' => 'No Body',
        ])->assertStatus(422)->assertJsonPath('error.code', 'validation_error')
            ->assertJsonValidationErrors('country', 'error.details');

        $this->assertDatabaseMissing('users', ['email' => 'nobody@example.com']);
    }
}
