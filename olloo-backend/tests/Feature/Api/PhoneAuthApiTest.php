<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Country;
use App\Models\User;
use App\Support\GhanaPhone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class PhoneAuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_ghana_numbers_normalise_to_e164_however_they_are_typed(): void
    {
        foreach (['0241234567', '024 123 4567', '+233 24 123 4567', '233241234567', '00233241234567', '241234567'] as $input) {
            $this->assertSame('+233241234567', GhanaPhone::normalize($input), $input);
        }

        // Landlines, wrong lengths and foreign numbers are not sign-in numbers.
        foreach (['0302123456', '02412345', '+447700900123', 'not a number'] as $input) {
            $this->assertNull(GhanaPhone::normalize($input), $input);
        }
    }

    public function test_register_with_phone_then_sign_in_with_any_spelling_of_the_number(): void
    {
        Country::query()->create(['code' => 'GH', 'name' => 'Ghana']);

        $this->postJson('/api/v1/auth/check-phone', ['phone' => '024 123 4567'])
            ->assertOk()
            ->assertJson(['exists' => false, 'nextStep' => 'register', 'phone' => '+233241234567']);

        $this->postJson('/api/v1/auth/register', [
            'phone' => '024 123 4567',
            'email' => 'kofi@example.com',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'fullName' => 'Kofi Boateng',
            'country' => 'GH',
        ])->assertCreated()
            ->assertJsonPath('user.phone', '+233241234567')
            ->assertJsonPath('user.email', 'kofi@example.com');

        $this->assertDatabaseHas('users', ['email' => 'kofi@example.com', 'login_phone' => '+233241234567']);

        $this->postJson('/api/v1/auth/check-phone', ['phone' => '+233241234567'])
            ->assertOk()
            ->assertJson(['exists' => true, 'nextStep' => 'password']);

        $this->postJson('/api/v1/auth/login', ['phone' => '0241234567', 'password' => 'Password1!'])
            ->assertOk()
            ->assertJsonStructure(['accessToken', 'refreshToken'])
            ->assertJsonPath('user.phone', '+233241234567');

        // Email sign-in still works for the same account.
        $this->postJson('/api/v1/auth/login', ['email' => 'kofi@example.com', 'password' => 'Password1!'])
            ->assertOk();
    }

    public function test_wrong_password_and_unknown_numbers_get_the_same_answer(): void
    {
        User::factory()->create(['login_phone' => '+233241234567', 'password' => 'Password1!']);

        $this->postJson('/api/v1/auth/login', ['phone' => '0241234567', 'password' => 'wrong'])
            ->assertStatus(422)
            ->assertJsonPath('error.message', 'The provided credentials are incorrect.');

        $this->postJson('/api/v1/auth/login', ['phone' => '0551234567', 'password' => 'Password1!'])
            ->assertStatus(422)
            ->assertJsonPath('error.message', 'The provided credentials are incorrect.');
    }

    public function test_invalid_numbers_are_rejected_with_a_helpful_message(): void
    {
        $this->postJson('/api/v1/auth/check-phone', ['phone' => '0302123456'])
            ->assertStatus(422)
            ->assertJsonPath('error.message', GhanaPhone::INVALID_MESSAGE);

        $this->postJson('/api/v1/auth/login', ['password' => 'Password1!'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'validation_error');
    }

    public function test_a_number_can_only_belong_to_one_live_account(): void
    {
        Country::query()->create(['code' => 'GH', 'name' => 'Ghana']);
        User::factory()->create(['login_phone' => '+233241234567']);

        $this->postJson('/api/v1/auth/register', [
            'phone' => '024-123-4567',
            'email' => 'second@example.com',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'fullName' => 'Second Person',
            'country' => 'GH',
        ])->assertStatus(422)
            ->assertJsonPath('error.message', 'An account already uses this phone number. Sign in instead.');

        $this->assertDatabaseMissing('users', ['email' => 'second@example.com']);
    }

    public function test_deleting_an_account_frees_its_number(): void
    {
        Country::query()->create(['code' => 'GH', 'name' => 'Ghana']);
        User::factory()->create(['login_phone' => '+233241234567'])->delete();

        $this->postJson('/api/v1/auth/register', [
            'phone' => '0241234567',
            'email' => 'fresh@example.com',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'fullName' => 'Fresh Start',
            'country' => 'GH',
        ])->assertCreated();
    }
}
