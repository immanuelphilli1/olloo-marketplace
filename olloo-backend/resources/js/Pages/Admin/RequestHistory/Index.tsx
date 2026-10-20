import { FormEvent, useState } from 'react';
import { Link, router } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import Pagination from '@/Components/Pagination';
import { useRoute } from '@/utils/route';

type LogRow = {
    rid: string;
    direction: string;
    service: string;
    action: string | null;
    requestMethod: string | null;
    requestUrl: string | null;
    statusCode: number | null;
    success: boolean | null;
    durationMs: number | null;
    createdAt: string | null;
    user?: { rid: string; name: string; email: string } | null;
    entities: Array<{ entityType: string; entityRid: string }>;
};

type Paginated<T> = {
    data: T[];
    links: Array<{ url: string | null; label: string; active: boolean }>;
};

type Filters = {
    direction: string;
    service: string;
    action: string;
    status_code: string;
    success: string;
    from: string;
    to: string;
    search: string;
    entity_type: string;
    entity_rid: string;
};

type Props = {
    logs: Paginated<LogRow>;
    filters: Filters;
    services: string[];
    actions: string[];
    directions: string[];
    entityTypes: string[];
};

export default function Index({
    logs,
    filters,
    services,
    actions,
    directions,
    entityTypes,
}: Props) {
    const route = useRoute();
    const [form, setForm] = useState(filters);

    const apply = (event: FormEvent) => {
        event.preventDefault();
        router.get(route('admin.request-history.index'), form, {
            preserveState: true,
            replace: true,
        });
    };

    return (
        <AdminLayout title="Request history">
            <form
                onSubmit={apply}
                className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
            >
                <Field label="Search">
                    <input
                        type="text"
                        value={form.search}
                        onChange={(e) => setForm({ ...form, search: e.target.value })}
                        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                </Field>
                <Field label="Direction">
                    <select
                        value={form.direction}
                        onChange={(e) => setForm({ ...form, direction: e.target.value })}
                        className="cursor-pointer w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    >
                        <option value="">All</option>
                        {directions.map((d) => (
                            <option key={d} value={d}>
                                {d}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Service">
                    <select
                        value={form.service}
                        onChange={(e) => setForm({ ...form, service: e.target.value })}
                        className="cursor-pointer w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    >
                        <option value="">All</option>
                        {services.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Action">
                    <select
                        value={form.action}
                        onChange={(e) => setForm({ ...form, action: e.target.value })}
                        className="cursor-pointer w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    >
                        <option value="">All</option>
                        {actions.map((a) => (
                            <option key={a} value={a}>
                                {a}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Status code">
                    <input
                        type="text"
                        value={form.status_code}
                        onChange={(e) => setForm({ ...form, status_code: e.target.value })}
                        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                </Field>
                <Field label="Success">
                    <select
                        value={form.success}
                        onChange={(e) => setForm({ ...form, success: e.target.value })}
                        className="cursor-pointer w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    >
                        <option value="">All</option>
                        <option value="1">Yes</option>
                        <option value="0">No</option>
                    </select>
                </Field>
                <Field label="From">
                    <input
                        type="date"
                        value={form.from}
                        onChange={(e) => setForm({ ...form, from: e.target.value })}
                        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                </Field>
                <Field label="To">
                    <input
                        type="date"
                        value={form.to}
                        onChange={(e) => setForm({ ...form, to: e.target.value })}
                        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                </Field>
                <Field label="Entity type">
                    <select
                        value={form.entity_type}
                        onChange={(e) => setForm({ ...form, entity_type: e.target.value })}
                        className="cursor-pointer w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    >
                        <option value="">Any</option>
                        {entityTypes.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Entity rid">
                    <input
                        type="text"
                        value={form.entity_rid}
                        onChange={(e) => setForm({ ...form, entity_rid: e.target.value })}
                        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                </Field>
                <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
                    <button
                        type="submit"
                        className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
                    >
                        Filter
                    </button>
                    <button
                        type="button"
                        className="cursor-pointer rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                        onClick={() =>
                            router.get(route('admin.request-history.index'), {}, { replace: true })
                        }
                    >
                        Clear
                    </button>
                </div>
            </form>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                            <th className="px-4 py-3 font-medium">When</th>
                            <th className="px-4 py-3 font-medium">Direction</th>
                            <th className="px-4 py-3 font-medium">Service</th>
                            <th className="px-4 py-3 font-medium">Action</th>
                            <th className="px-4 py-3 font-medium">Method</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Duration</th>
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
                                <td className="px-4 py-3">{log.requestMethod ?? '-'}</td>
                                <td className="px-4 py-3">
                                    {log.statusCode ?? '-'}
                                    {log.success === true && (
                                        <span className="ml-1 text-xs text-emerald-600">ok</span>
                                    )}
                                    {log.success === false && (
                                        <span className="ml-1 text-xs text-red-600">fail</span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    {log.durationMs != null ? `${log.durationMs} ms` : '-'}
                                </td>
                                <td className="px-4 py-3">
                                    <Link
                                        href={route('admin.request-history.show', {
                                            log: log.rid,
                                        })}
                                        className="cursor-pointer text-slate-700 underline"
                                    >
                                        View
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        {logs.data.length === 0 && (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="px-4 py-8 text-center text-slate-500"
                                >
                                    No request logs found.
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

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <label className="block text-sm">
            <span className="mb-1 block text-slate-700">{label}</span>
            {children}
        </label>
    );
}
