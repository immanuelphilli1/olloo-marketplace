import { FormEvent, useMemo, useState } from 'react';
import { Link, router } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import Pagination from '@/Components/Pagination';
import { useRoute } from '@/utils/route';
import { getNotificationHref } from '@/utils/notificationLinks';

type NotificationRow = {
    rid: string;
    type: string;
    title: string;
    message: string;
    data: Record<string, unknown>;
    isRead: boolean;
    readAt: string | null;
    createdAt: string | null;
};

type Paginated<T> = {
    data: T[];
    links: Array<{ url: string | null; label: string; active: boolean }>;
};

type Filters = {
    type: string;
    status: string;
    search: string;
};

type Props = {
    notifications: Paginated<NotificationRow>;
    unreadCount: number;
    filters: Filters;
    types: string[];
};

export default function Index({ notifications, unreadCount, filters, types }: Props) {
    const route = useRoute();
    const [form, setForm] = useState(filters);
    const [selected, setSelected] = useState<string[]>([]);

    const allRids = useMemo(() => notifications.data.map((n) => n.rid), [notifications.data]);
    const allSelected = allRids.length > 0 && allRids.every((rid) => selected.includes(rid));

    const apply = (event: FormEvent) => {
        event.preventDefault();
        router.get(route('admin.notifications.index'), form, {
            preserveState: true,
            replace: true,
        });
    };

    const toggleAll = () => {
        setSelected(allSelected ? [] : allRids);
    };

    const toggleOne = (rid: string) => {
        setSelected((prev) =>
            prev.includes(rid) ? prev.filter((r) => r !== rid) : [...prev, rid],
        );
    };

    const bulk = (action: 'read' | 'unread') => {
        if (selected.length === 0) return;
        router.post(
            route('admin.notifications.bulk'),
            { rids: selected, action },
            {
                preserveScroll: true,
                onSuccess: () => setSelected([]),
            },
        );
    };

    const markAllRead = () => {
        router.post(route('admin.notifications.mark-all-read'), {}, { preserveScroll: true });
    };

    const openNotification = (row: NotificationRow) => {
        const href = getNotificationHref(row.type, row.data, route);
        const after = () => {
            if (href) {
                router.visit(href);
            }
        };

        if (!row.isRead) {
            router.post(
                route('admin.notifications.read', row.rid),
                {},
                { preserveScroll: true, onSuccess: after },
            );
            return;
        }

        after();
    };

    return (
        <AdminLayout title="Notifications">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                    {unreadCount === 0
                        ? 'No unread notifications.'
                        : `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}.`}
                </p>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={toggleAll}
                        disabled={allRids.length === 0}
                        className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {allSelected ? 'Uncheck all' : 'Check all'}
                    </button>
                    <button
                        type="button"
                        onClick={() => bulk('read')}
                        disabled={selected.length === 0}
                        className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Mark selected read
                    </button>
                    <button
                        type="button"
                        onClick={() => bulk('unread')}
                        disabled={selected.length === 0}
                        className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Mark selected unread
                    </button>
                    <button
                        type="button"
                        onClick={markAllRead}
                        className="cursor-pointer rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
                    >
                        Mark all read
                    </button>
                </div>
            </div>

            <form
                onSubmit={apply}
                className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-4"
            >
                <label className="block text-sm">
                    <span className="mb-1 block text-slate-600">Search</span>
                    <input
                        type="search"
                        value={form.search}
                        onChange={(e) => setForm({ ...form, search: e.target.value })}
                        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                </label>
                <label className="block text-sm">
                    <span className="mb-1 block text-slate-600">Type</span>
                    <select
                        value={form.type}
                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                        className="w-full cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    >
                        <option value="">All</option>
                        {types.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="block text-sm">
                    <span className="mb-1 block text-slate-600">Status</span>
                    <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                        className="w-full cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    >
                        <option value="">All</option>
                        <option value="unread">Unread</option>
                        <option value="read">Read</option>
                    </select>
                </label>
                <div className="flex items-end gap-2">
                    <button
                        type="submit"
                        className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm text-white"
                    >
                        Apply
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setForm({ type: '', status: '', search: '' });
                            router.get(route('admin.notifications.index'), {}, { replace: true });
                        }}
                        className="cursor-pointer rounded-md border border-slate-300 px-4 py-2 text-sm"
                    >
                        Clear
                    </button>
                </div>
            </form>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                            <th className="px-4 py-3">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={toggleAll}
                                    className="cursor-pointer"
                                    aria-label="Select all"
                                />
                            </th>
                            <th className="px-4 py-3 font-medium">When</th>
                            <th className="px-4 py-3 font-medium">Type</th>
                            <th className="px-4 py-3 font-medium">Notification</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {notifications.data.map((row) => (
                            <tr
                                key={row.rid}
                                className={`border-b border-slate-100 align-top ${row.isRead ? '' : 'bg-sky-50/40'}`}
                            >
                                <td className="px-4 py-3">
                                    <input
                                        type="checkbox"
                                        checked={selected.includes(row.rid)}
                                        onChange={() => toggleOne(row.rid)}
                                        className="cursor-pointer"
                                        aria-label={`Select ${row.title}`}
                                    />
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                                    {row.createdAt ? new Date(row.createdAt).toLocaleString() : '-'}
                                </td>
                                <td className="px-4 py-3">
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                                        {row.type}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <button
                                        type="button"
                                        onClick={() => openNotification(row)}
                                        className="cursor-pointer text-left"
                                    >
                                        <div className="font-medium text-slate-900">{row.title}</div>
                                        <div className="mt-0.5 text-xs text-slate-500">{row.message}</div>
                                    </button>
                                </td>
                                <td className="px-4 py-3">
                                    {row.isRead ? (
                                        <span className="text-xs text-slate-500">Read</span>
                                    ) : (
                                        <span className="rounded bg-sky-50 px-1.5 py-0.5 text-xs text-sky-800">
                                            Unread
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-2">
                                        {row.isRead ? (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    router.post(
                                                        route('admin.notifications.unread', row.rid),
                                                        {},
                                                        { preserveScroll: true },
                                                    )
                                                }
                                                className="cursor-pointer text-xs text-indigo-700 underline"
                                            >
                                                Mark unread
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    router.post(
                                                        route('admin.notifications.read', row.rid),
                                                        {},
                                                        { preserveScroll: true },
                                                    )
                                                }
                                                className="cursor-pointer text-xs text-indigo-700 underline"
                                            >
                                                Mark read
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.delete(
                                                    route('admin.notifications.destroy', row.rid),
                                                    { preserveScroll: true },
                                                )
                                            }
                                            className="cursor-pointer text-xs text-red-600 underline"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {notifications.data.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                                    No notifications match these filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-4">
                <Pagination links={notifications.links} />
            </div>

            <div className="mt-2">
                <Link
                    href={route('admin.notification-settings.edit')}
                    className="cursor-pointer text-sm text-slate-600 underline"
                >
                    Configure email recipients
                </Link>
            </div>
        </AdminLayout>
    );
}
