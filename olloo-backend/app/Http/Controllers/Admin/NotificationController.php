<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\StaffNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class NotificationController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user('staff') !== null, 403);

        $staff = $request->user('staff');
        $type = trim((string) $request->query('type', ''));
        $status = trim((string) $request->query('status', ''));
        $search = trim((string) $request->query('search', ''));

        $query = StaffNotification::query()
            ->where('user_id', $staff->id)
            ->latest('id');

        if ($type !== '') {
            $query->where('type', $type);
        }

        if ($status === 'unread') {
            $query->whereNull('read_at');
        } elseif ($status === 'read') {
            $query->whereNotNull('read_at');
        }

        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($q) use ($like): void {
                $q->where('title', 'like', $like)
                    ->orWhere('message', 'like', $like);
            });
        }

        $notifications = $query->paginate((int) config('admin.per_page'))->withQueryString()->through(
            fn (StaffNotification $n) => $this->toListItem($n),
        );

        $unreadCount = StaffNotification::query()
            ->where('user_id', $staff->id)
            ->whereNull('read_at')
            ->count();

        return Inertia::render('Admin/Notifications/Index', [
            'notifications' => $notifications,
            'unreadCount' => $unreadCount,
            'filters' => [
                'type' => $type,
                'status' => $status,
                'search' => $search,
            ],
            'types' => ['payment', 'inquiry'],
        ]);
    }

    public function markAsRead(Request $request, StaffNotification $notification): RedirectResponse
    {
        abort_unless($request->user('staff') !== null, 403);
        $this->assertOwns($request, $notification);
        $notification->markAsRead();

        return back();
    }

    public function markAsUnread(Request $request, StaffNotification $notification): RedirectResponse
    {
        abort_unless($request->user('staff') !== null, 403);
        $this->assertOwns($request, $notification);
        $notification->markAsUnread();

        return back();
    }

    public function markAllAsRead(Request $request): RedirectResponse
    {
        abort_unless($request->user('staff') !== null, 403);

        StaffNotification::query()
            ->where('user_id', $request->user('staff')->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return back()->with('success', 'All notifications marked as read.');
    }

    public function bulkUpdate(Request $request): RedirectResponse
    {
        abort_unless($request->user('staff') !== null, 403);

        $validated = $request->validate([
            'rids' => ['required', 'array', 'min:1'],
            'rids.*' => ['required', 'string', 'max:12'],
            'action' => ['required', 'string', 'in:read,unread'],
        ]);

        $query = StaffNotification::query()
            ->where('user_id', $request->user('staff')->id)
            ->whereIn('rid', $validated['rids']);

        if ($validated['action'] === 'read') {
            $query->whereNull('read_at')->update(['read_at' => now()]);
        } else {
            $query->whereNotNull('read_at')->update(['read_at' => null]);
        }

        return back();
    }

    public function destroy(Request $request, StaffNotification $notification): RedirectResponse
    {
        abort_unless($request->user('staff') !== null, 403);
        $this->assertOwns($request, $notification);
        $notification->delete();

        return back()->with('success', 'Notification deleted.');
    }

    public function unreadCount(Request $request): JsonResponse
    {
        abort_unless($request->user('staff') !== null, 403);

        $count = StaffNotification::query()
            ->where('user_id', $request->user('staff')->id)
            ->whereNull('read_at')
            ->count();

        return response()->json(['count' => $count]);
    }

    private function assertOwns(Request $request, StaffNotification $notification): void
    {
        abort_unless((int) $notification->user_id === (int) $request->user('staff')->id, 403);
    }

    /**
     * @return array<string, mixed>
     */
    private function toListItem(StaffNotification $n): array
    {
        return [
            'rid' => $n->rid,
            'type' => $n->type,
            'title' => $n->title,
            'message' => $n->message,
            'data' => $n->data ?? [],
            'isRead' => $n->isRead(),
            'readAt' => $n->read_at?->toIso8601String(),
            'createdAt' => $n->created_at?->toIso8601String(),
        ];
    }
}
