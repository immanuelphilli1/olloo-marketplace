<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasRid;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRid, HasRoles, Notifiable, SoftDeletes;

    protected $guard_name = 'staff';

    protected $fillable = [
        'rid',
        'name',
        'display_name',
        'email',
        'phone',
        'login_phone',
        'avatar_path',
        'user_type',
        'is_guest',
        'two_factor_enabled',
        'two_factor_secret',
        'must_change_password',
        'notify_promotions',
        'notify_order_updates',
        'email_verified_at',
        'password',
        'oauth_provider',
        'oauth_provider_id',
    ];

    protected $hidden = [
        'id',
        'password',
        'remember_token',
        'two_factor_secret',
        'active_email',
        'active_login_phone',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_guest' => 'boolean',
            'two_factor_enabled' => 'boolean',
            // TOTP seed for staff MFA: encrypted at rest with APP_KEY.
            'two_factor_secret' => 'encrypted',
            'must_change_password' => 'boolean',
            'notify_promotions' => 'boolean',
            'notify_order_updates' => 'boolean',
        ];
    }

    public function isStaff(): bool
    {
        return $this->user_type === 'staff';
    }

    public function cart(): HasOne
    {
        return $this->hasOne(Cart::class);
    }

    public function addresses(): HasMany
    {
        return $this->hasMany(Address::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function wishlists(): HasMany
    {
        return $this->hasMany(Wishlist::class);
    }

    public function savedPaymentMethods(): HasMany
    {
        return $this->hasMany(SavedPaymentMethod::class);
    }

    public function refreshTokens(): HasMany
    {
        return $this->hasMany(RefreshToken::class);
    }

    public function toAuthArray(): array
    {
        return [
            'rid' => $this->rid,
            'displayName' => $this->display_name ?: explode(' ', $this->name)[0],
            'fullName' => $this->name,
            'email' => $this->email,
            // The sign-in number in E.164 (`+233...`), null for email-only accounts.
            'phone' => $this->login_phone,
        ];
    }
}
