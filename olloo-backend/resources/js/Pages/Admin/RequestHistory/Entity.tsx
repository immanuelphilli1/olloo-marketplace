import { Link } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import Pagination from '@/Components/Pagination';
import { useRoute } from '@/utils/route';

type LogRow = {
    rid: string;
    direction: string;
    service: string;
    action: string | null;
    requestMethod: string | null;
    statusCode: number | null;
    success: boolean | null;
    durationMs: number | null;
    createdAt: string | null;
};

type Paginated<T> = {
    data: T[];
    links: Array<{ url: string | null; label: string; active: boolean }>;
};

type Props = {
    logs: Paginated<LogRow>;
    entityType: string;
    entityRid: string;
};

export default function Entity({ logs, entityType, entityRid }: Props) {
    const route = useRoute();

    return (
        <AdminLayout title="Entity request history">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                    {entityType} · {entityRid}
                </p>
                <Link
                    href={route('admin.request-history.index')}
                    className="cursor-pointer text-sm text-slate-600 underline"
                >
                    All request history
                </Link>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                            <th className="px-4 py-3 font-medium">When</th>
                            <th className="px-4 py-3 font-medium">Direction</th>
                            <th className="px-4 py-3 font-medium">Service</th>
                            <th className="px-4 py-3 font-medium">Action</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.data.map((log) => (
                            <tr key={log.rid} className="border-b border-slate-100">
                                <td className="px-4 py-3 text-slate-600">
                                    {log.createdAt
                                        ? new Date(log.createdAt).toLocaleString()
                                        : '-'}
                                </td>
                                <td className="px-4 py-3">{log.direction}</td>
                                <td className="px-4 py-3">{log.service}</td>
                                <td className="px-4 py-3">{log.action ?? '-'}</td>
                                <td className="px-4 py-3">{log.statusCode ?? '-'}</td>
                                <td className="px-4 py-3">
                                    <Link
                                        href={route('admin.request-history.show', {
                                            log: log.rid,
                                        })}
                                        className="cursor-pointer underline"
                                    >
                                        View
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        {logs.data.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="px-4 py-8 text-center text-slate-500"
                                >
                                    No logs for this entity.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination links={logs.links} />
        </AdminLayout>
    );
}
