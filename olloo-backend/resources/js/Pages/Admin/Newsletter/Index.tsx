import { router } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import Pagination from '@/Components/Pagination';
import { useRoute } from '@/utils/route';

type SubscriberRow = {
    rid: string;
    email: string;
    subscribedAt: string | null;
    unsubscribedAt: string | null;
};

type Props = {
    subscribers: {
        data: SubscriberRow[];
        links: Array<{ url: string | null; label: string; active: boolean }>;
    };
    filters: { search: string };
    canDelete: boolean;
};

export default function Index({ subscribers, filters, canDelete }: Props) {
    const route = useRoute();

    return (
        <AdminLayout title="Newsletter">
            <form
                className="mb-4 flex gap-2"
                onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    router.get(
                        route('admin.newsletter.index'),
                        { search: String(data.get('search') || '') || undefined },
                        { preserveState: true, replace: true },
                    );
                }}
            >
                <input
                    name="search"
                    defaultValue={filters.search}
                    placeholder="Search email"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
                <button type="submit" className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm">
                    Search
                </button>
            </form>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                            <th className="px-4 py-3 font-medium">Email</th>
                            <th className="px-4 py-3 font-medium">Subscribed</th>
                            <th className="px-4 py-3 font-medium">Unsubscribed</th>
                            <th className="px-4 py-3 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {subscribers.data.map((subscriber) => (
                            <tr key={subscriber.rid} className="border-b border-slate-100">
                                <td className="px-4 py-3">{subscriber.email}</td>
                                <td className="px-4 py-3">
                                    {subscriber.subscribedAt
                                        ? new Date(subscriber.subscribedAt).toLocaleString()
                                        : '-'}
                                </td>
                                <td className="px-4 py-3">
                                    {subscriber.unsubscribedAt
                                        ? new Date(subscriber.unsubscribedAt).toLocaleString()
                                        : '-'}
                                </td>
                                <td className="px-4 py-3">
                                    {canDelete && (
                                        <button
                                            type="button"
                                            className="cursor-pointer text-red-600 underline"
                                            onClick={() => {
                                                if (confirm(`Remove ${subscriber.email}?`)) {
                                                    router.delete(
                                                        route('admin.newsletter.destroy', subscriber.rid),
                                                    );
                                                }
                                            }}
                                        >
                                            Remove
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {subscribers.data.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                                    No subscribers found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <Pagination links={subscribers.links} />
        </AdminLayout>
    );
}
