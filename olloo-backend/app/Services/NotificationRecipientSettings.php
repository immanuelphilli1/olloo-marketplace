<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AppSetting;
use Illuminate\Support\Facades\Cache;

final class NotificationRecipientSettings
{
    public const CACHE_KEY = 'app_settings.notification_recipients_v1';

    public const CHANNEL_PAYMENT = 'payment';

    public const CHANNEL_INQUIRY = 'inquiry';

    private const KEY_PREFIX = 'notification.';

    /** @var list<string> */
    public const CHANNELS = [
        self::CHANNEL_PAYMENT,
        self::CHANNEL_INQUIRY,
    ];

    public function keyFor(string $channel, string $suffix = 'emails'): string
    {
        return self::KEY_PREFIX.$channel.'.'.$suffix;
    }

    /**
     * @return array<string, array{emails: string}>
     */
    public function allRawValues(): array
    {
        $out = [];
        foreach (self::CHANNELS as $channel) {
            $out[$channel] = [
                'emails' => (string) ($this->getStoredRaw($channel) ?? ''),
            ];
        }

        return $out;
    }

    /**
     * @return list<string>
     */
    public function getEmails(string $channel): array
    {
        return $this->parseEmailList($this->getStoredRaw($channel));
    }

    /**
     * @param  array<string, array{emails?: string}>  $data
     */
    public function save(array $data): void
    {
        foreach (self::CHANNELS as $channel) {
            $payload = $data[$channel] ?? [];
            $this->upsertValue($channel, $this->sanitizeStoredText((string) ($payload['emails'] ?? '')));
        }

        $this->clearCache();
    }

    public function clearCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    private function getStoredRaw(string $channel): ?string
    {
        /** @var array<string, string|null> $map */
        $map = Cache::remember(self::CACHE_KEY, 60, function (): array {
            $rows = AppSetting::query()
                ->where('key', 'like', self::KEY_PREFIX.'%')
                ->pluck('value', 'key')
                ->all();

            $out = [];
            foreach (self::CHANNELS as $channel) {
                $key = $this->keyFor($channel);
                $out[$key] = isset($rows[$key]) ? (string) $rows[$key] : null;
            }

            return $out;
        });

        $key = $this->keyFor($channel);

        return $map[$key] ?? null;
    }

    private function upsertValue(string $channel, string $value): void
    {
        AppSetting::query()->updateOrCreate(
            ['key' => $this->keyFor($channel)],
            ['value' => $value],
        );
    }

    private function sanitizeStoredText(string $value): string
    {
        $parts = $this->parseEmailList($value);

        return implode(', ', $parts);
    }

    /**
     * @return list<string>
     */
    private function parseEmailList(?string $raw): array
    {
        if ($raw === null || trim($raw) === '') {
            return [];
        }

        $parts = preg_split('/[\s,;]+/', $raw) ?: [];
        $emails = [];
        foreach ($parts as $part) {
            $email = strtolower(trim($part));
            if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
                continue;
            }
            $emails[$email] = $email;
        }

        return array_values($emails);
    }
}
