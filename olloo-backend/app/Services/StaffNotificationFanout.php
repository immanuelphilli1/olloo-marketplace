<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\StaffNotification;
use App\Models\User;
use Illuminate\Support\Collection;

final class StaffNotificationFanout
{
    /**
     * Create in-app notifications only for staff users whose email is in $emails.
     *
     * @param  list<string>  $emails
     * @param  array<string, mixed>  $data
     * @return Collection<int, StaffNotification>
     */
    public function notifyStaffEmails(
        array $emails,
        string $type,
        string $title,
        string $message,
        array $data = [],
    ): Collection {
        $normalized = $this->normalizeEmails($emails);
        if ($normalized === []) {
            return collect();
        }

        $staffUsers = User::query()
            ->where('user_type', 'staff')
            ->get(['id', 'email'])
            ->filter(function (User $user) use ($normalized): bool {
                $email = strtolower(trim((string) $user->email));

                return $email !== '' && isset($normalized[$email]);
            });

        $created = collect();

        foreach ($staffUsers as $staff) {
            $created->push(StaffNotification::query()->create([
                'user_id' => $staff->id,
                'type' => $type,
                'title' => $title,
                'message' => $message,
                'data' => $data,
            ]));
        }

        return $created;
    }

    /**
     * @param  list<string>  $emails
     * @return array<string, string>
     */
    private function normalizeEmails(array $emails): array
    {
        $out = [];
        foreach ($emails as $email) {
            if (! is_string($email)) {
                continue;
            }
            $email = strtolower(trim($email));
            if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
                continue;
            }
            $out[$email] = $email;
        }

        return $out;
    }
}
