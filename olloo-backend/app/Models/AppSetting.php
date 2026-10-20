<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class AppSetting extends Model
{
    protected $fillable = [
        'key',
        'value',
    ];

    protected static function booted(): void
    {
        $forget = static function (AppSetting $setting): void {
            if (str_starts_with((string) $setting->key, 'notification.')) {
                Cache::forget('app_settings.notification_recipients_v1');
            }
        };

        static::saved($forget);
        static::deleted($forget);
    }
}
