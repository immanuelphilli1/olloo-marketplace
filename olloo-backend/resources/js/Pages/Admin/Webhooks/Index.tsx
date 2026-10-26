import { FormEvent, useState } from 'react';
import { Link, router } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import Pagination from '@/Components/Pagination';
import { useRoute } from '@/utils/route';

type EventRow = {
    rid: string;
    provider: string;
    externalEventId: string | null;
    eventType: string | null;
    processedAt: string | null;
    createdAt: string | null;
};

type Paginated<T> = {
    data: T[];
    links: Array<{ url: string | null; label: string; active: boolean }>;
};

type Props = {
    events: Paginated<EventRow>;
    filters: {
        provider: string;
        search: string;
        processed: string;
    };
    providers: string[];
    canReplay: boolean;
};

export default function Index({ events, filters, providers, canReplay }: Props) {
    const route = useRoute();
    const [form, setForm] = useState(filters);

    const apply = (event: FormEvent) => {
        event.preventDefault();
        router.get(route('admin.webhooks.index'), form, {
            preserveState: true,
            replace: true,
        });
    };

    return (
        <AdminLayout title="Webhooks">
            <form
                onSubmit={apply}
                className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
            >
                <label className="text-sm">
                    <span className="mb-1 block text-slate-700">Search</span>
                    <input
                        type="text"
                        value={form.search}
                        onChange={(e) => setForm({ ...form, search: e.target.value })}
                        className="rounded-md border border-slate-300 px-3 py-1.5"
                    />
                </label>
                <label className="text-sm">
                    <span className="mb-1 block text-slate-700">Provider</span>
                    <select
                        value={form.provider}
                        onChange={(e) => setForm({ ...form, provider: e.target.value })}
                        className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5"
                    >
                        <option value="">All</option>
                        {providers.map((provider) => (
                            <option key={provider} value={provider}>
                                {provider}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="text-sm">
                    <span className="mb-1 block text-slate-700">Processed</span>
                    <select
                        value={form.processed}
                        onChange={(e) => setForm({ ...form, processed: e.target.value })}
                        className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5"
                    >
                        <option value="">All</option>
                        <option value="1">Yes</option>
                        <option value="0">No</option>
                    </select>
                </label>
                <button
                    type="submit"
                    className="cursor-pointer rounded-md bg-brand px-4 py-2 text-sm text-white hover:bg-brand-dark"
                >
                    Filter
                </button>
            </form>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                            <th className="px-4 py-3 font-medium">Provider</th>
                            <th className="px-4 py-3 font-medium">Event</th>
                            <th className="px-4 py-3 font-medium">External id</th>
                            <th className="px-4 py-3 font-medium">Processed</th>
                            <th className="px-4 py-3 font-medium">Created</th>
                            <th className="px-4 py-3 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {events.data.map((event) => (
                            <tr key={event.rid} className="border-b border-slate-100">
                                <td className="px-4 py-3">{event.provider}</td>
                                <td className="px-4 py-3">{event.eventType ?? '-'}</td>
                                <td className="px-4 py-3 font-mono text-xs">
                                    {event.externalEventId ?? '-'}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {event.processedAt
                                        ? new Date(event.processedAt).toLocaleString()
                                        : 'Pending'}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {event.createdAt
                                        ? new Date(event.createdAt).toLocaleString()
                                        : '-'}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-2">
                                        <Link
                                            href={route('admin.webhooks.show', {
                                                webhook: event.rid,
                                            })}
                                            className="cursor-pointer underline"
                                        >
                                            View
                                        </Link>
                                        {canReplay && (
                                            <button
                                                type="button"
                                                className="cursor-pointer text-slate-700 underline"
                                                onClick={() => {
                                                    if (confirm('Replay this webhook?')) {
                                                        router.post(
                                                            route('admin.webhooks.replay', {
                                                                webhook: event.rid,
                                                            }),
                                                        );
                                                    }
                                                }}
                                            >
                                                Replay
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {events.data.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="px-4 py-8 text-center text-slate-500"
                                >
                                    No webhook events found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination links={events.links} />
        </AdminLayout>
    );
}
