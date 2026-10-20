<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateNotificationSettingsRequest;
use App\Services\NotificationRecipientSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class NotificationSettingsController extends Controller
{
    public function __construct(
        private readonly NotificationRecipientSettings $notificationSettings,
    ) {}

    public function edit(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('manage_notification_settings'), 403);

        return Inertia::render('Admin/Settings/NotificationSettings', [
            'settings' => $this->notificationSettings->allRawValues(),
        ]);
    }

    public function update(UpdateNotificationSettingsRequest $request): RedirectResponse
    {
        $this->notificationSettings->save($request->validated());

        return redirect()
            ->route('admin.notification-settings.edit')
            ->with('success', 'Notification recipients updated.');
    }
}
