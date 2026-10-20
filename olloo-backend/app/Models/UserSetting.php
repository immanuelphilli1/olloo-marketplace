<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One setting for one shopper. A key/value table rather than columns on users,
 * so a new preference needs no migration.
 *
 * Two keys carry the country we place a shopper in:
 * - ASSIGNED_COUNTRY is what we worked out (their IP, or staff).
 * - PREFERRED_COUNTRY is what they asked for, and it wins.
 *
 * @property int $user_id
 * @property string $config_name
 * @property string|null $config_value
 */
class UserSetting extends Model
{
    /** Where we placed this shopper, from their IP or by staff. */
    public const ASSIGNED_COUNTRY = 'assigned_country';

    /** What the shopper chose for themselves. Wins over the assigned country. */
    public const PREFERRED_COUNTRY = 'preferred_country';

    protected $fillable = [
        'user_id',
        'config_name',
        'config_display_name',
        'config_value',
        'config_type',
        'config_options',
        'config_hint',
    ];

    protected function casts(): array
    {
        return [
            'config_options' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * A single setting's value for a user, or null when it is unset.
     */
    public static function valueFor(int $userId, string $name): ?string
    {
        $value = static::query()
            ->where('user_id', $userId)
            ->where('config_name', $name)
            ->value('config_value');

        return is_string($value) && $value !== '' ? $value : null;
    }

    /**
     * Set a value, or clear it when `$value` is null. A cleared setting is
     * deleted rather than left as an empty row, so "unset" has exactly one
     * representation.
     */
    public static function put(int $userId, string $name, ?string $value): void
    {
        if ($value === null || trim($value) === '') {
            static::query()
                ->where('user_id', $userId)
                ->where('config_name', $name)
                ->delete();

            return;
        }

        static::query()->updateOrCreate(
            ['user_id' => $userId, 'config_name' => $name],
            ['config_value' => trim($value)],
        );
    }

    /**
     * Record a value only if the user has none yet. Used for the assigned
     * country, which we detect once and then leave alone: re-detecting on every
     * request would move a shopper's currency the moment their IP changed, and
     * a bad first guess (VPN, corporate proxy) would stick until staff fixed it.
     * A shopper who wants a different country sets a preferred one.
     */
    public static function putIfAbsent(int $userId, string $name, ?string $value): void
    {
        if ($value === null || trim($value) === '') {
            return;
        }

        $alreadySet = static::query()
            ->where('user_id', $userId)
            ->where('config_name', $name)
            ->exists();

        if ($alreadySet) {
            return;
        }

        static::query()->create([
            'user_id' => $userId,
            'config_name' => $name,
            'config_value' => trim($value),
        ]);
    }
}
