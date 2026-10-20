<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\StaffNotification;
use Illuminate\Http\Request;
use Inertia\Middleware;
use Tighten\Ziggy\Ziggy;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $staff = $request->user('staff');

        return [
            ...parent::share($request),
            'auth' => [
                'staff' => $staff === null ? null : [
                    'rid' => $staff->rid,
                    'name' => $staff->name,
                    'email' => $staff->email,
                    'permissions' => $staff->getAllPermissions()->pluck('name')->values()->all(),
                ],
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
            'unreadNotificationCount' => function () use ($staff): int {
                if ($staff === null) {
                    return 0;
                }

                return StaffNotification::query()
                    ->where('user_id', $staff->id)
                    ->whereNull('read_at')
                    ->count();
            },
            // Admin-only Inertia app: share the full Ziggy map so guest auth pages
            // can still resolve admin.login / MFA / force-password named routes.
            'ziggy' => fn () => [
                ...(new Ziggy)->toArray(),
                'location' => $request->url(),
            ],
        ];
    }
}
