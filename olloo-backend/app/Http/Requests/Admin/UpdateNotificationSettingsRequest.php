<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

final class UpdateNotificationSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user('staff');

        return $user !== null && $user->can('manage_notification_settings');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $channelRules = ['nullable', 'string', 'max:16000'];

        return [
            'payment' => ['required', 'array'],
            'payment.emails' => $channelRules,
            'inquiry' => ['required', 'array'],
            'inquiry.emails' => $channelRules,
        ];
    }
}
