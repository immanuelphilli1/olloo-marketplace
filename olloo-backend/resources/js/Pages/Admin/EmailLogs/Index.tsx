import { FormEvent, useState } from 'react';
import { Link, router } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import Pagination from '@/Components/Pagination';
import { useRoute } from '@/utils/route';

type LogRow = {
    rid: string;
    status: string;
    mailer: string | null;
    subject: string | null;
    to: string[];
    mailableShort: string | null;
    notificationShort: string | null;
    hasHtml: boolean;
    attachmentCount: number;
    sizeBytes: number | null;
    durationMs: number | null;
    exceptionMessage: string | null;
    isRead: boolean;
    readAt: string | null;
    openCount: number;
    sentAt: string | null;
    failedAt: string | null;
    createdAt: string | null;
};

type Paginated<T> = {
    data: T[];
    links: Array<{ url: string | null; label: string; active: boolean }>;
};

type Filters = {
    status: string;
    mailer: string;
    mailable: string;
    search: string;
    from: string;
    to: string;
    has_html: string;
    failed_only: string;
    read: string;
};

type Stats = {
    sentToday: number;
    failedToday: number;
    sending: number;
    readToday: number;
    total: number;
};

type Props = {
    logs: Paginated<LogRow>;
    filters: Filters;
    mailers: string[];
    statuses: string[];
    stats: Stats;
};

const STATUS_STYLES: Record<string, string> = {
    sent: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
    failed: 'bg-red-50 text-red-800 ring-red-600/20',
    sending: 'bg-amber-50 text-amber-900 ring-amber-600/20',
    queued: 'bg-slate-100 text-slate-700 ring-slate-500/20',
};

function formatBytes(bytes: number | null): string {
    if (bytes == null) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Index({ logs, filters, mailers, statuses, stats }: Props) {
    const route = useRoute();
    const [form, setForm] = useState(filters);

    const apply = (event: FormEvent) => {
        event.preventDefault();
        router.get(route('admin.email-logs.index'), form, {
            preserveState: true,
            replace: true,
        });
    };

    const clear = () => {
        const empty: Filters = {
            status: '',
            mailer: '',
            mailable: '',
            search: '',
            from: '',
            to: '',
            has_html: '',
            failed_only: '',
            read: '',
        };
        setForm(empty);
        router.get(route('admin.email-logs.index'), {}, { replace: true });
    };

    return (
        <AdminLayout title="Email logs">
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard label="Sent today" value={stats.sentToday} tone="emerald" />
                <StatCard label="Failed today" value={stats.failedToday} tone="red" />
                <StatCard label="In flight" value={stats.sending} tone="amber" />
                <StatCard label="Read today" value={stats.readToday} tone="slate" />
                <StatCard label="Total logged" value={stats.total} tone="slate" />
            </div>

            <form
                onSubmit={apply}
                className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
            >
                <Field label="Search">
                    <input
                        type="search"
                        value={form.search}
                        onChange={(e) => setForm({ ...form, search: e.target.value })}
                        placeholder="Subject, recipient, rid…"
                        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                </Field>
                <Field label="Status">
                    <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value, failed_only: '' })}
                        className="w-full cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    >
                        <option value="">All</option>
                        {statuses.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Mailer">
                    <select
                        value={form.mailer}
                        onChange={(e) => setForm({ ...form, mailer: e.target.value })}
                        className="w-full cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    >
                        <option value="">All</option>
                        {mailers.map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Mailable / notification">
                    <input
                        type="text"
                        value={form.mailable}
                        onChange={(e) => setForm({ ...form, mailable: e.target.value })}
                        placeholder="ResetPassword, Invite…"
                        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                </Field>
                <Field label="From date">
                    <input
                        type="date"
                        value={form.from}
                        onChange={(e) => setForm({ ...form, from: e.target.value })}
                        className="w-full cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                </Field>
                <Field label="To date">
                    <input
                        type="date"
                        value={form.to}
                        onChange={(e) => setForm({ ...form, to: e.target.value })}
                        className="w-full cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                </Field>
                <Field label="Has HTML">
                    <select
                        value={form.has_html}
                        onChange={(e) => setForm({ ...form, has_html: e.target.value })}
                        className="w-full cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    >
                        <option value="">Any</option>
                        <option value="1">Yes</option>
                        <option value="0">No</option>
                    </select>
                </Field>
                <Field label="Read">
                    <select
                        value={form.read}
                        onChange={(e) => setForm({ ...form, read: e.target.value })}
                        className="w-full cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    >
                        <option value="">Any</option>
                        <option value="1">Read</option>
                        <option value="0">Unread</option>
                    </select>
                </Field>
                <div className="flex items-end gap-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                        <input
                            type="checkbox"
                            checked={form.failed_only === '1'}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    failed_only: e.target.checked ? '1' : '',
                                    status: e.target.checked ? '' : form.status,
                                })
                            }
                            className="cursor-pointer"
                        />
                        Failed only
                    </label>
                </div>
                <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
                    <button
                        type="submit"
                        className="cursor-pointer rounded-md bg-brand px-4 py-2 text-sm text-white"
                    >
                        Apply filters
                    </button>
                    <button
                        type="button"
                        onClick={clear}
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
                            <th className="px-4 py-3 font-medium">When</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Subject / recipients</th>
                            <th className="px-4 py-3 font-medium">Type</th>
                            <th className="px-4 py-3 font-medium">Mailer</th>
                            <th className="px-4 py-3 font-medium">Size</th>
                            <th className="px-4 py-3 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.data.map((log) => (
                            <tr key={log.rid} className="border-b border-slate-100 align-top">
                                <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                                    {log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}
                                    {log.durationMs != null && (
                                        <div className="text-xs text-slate-400">{log.durationMs} ms</div>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[log.status] ?? STATUS_STYLES.queued}`}
                                    >
                                        {log.status}
                                    </span>
                                    {log.isRead ? (
                                        <div className="mt-1 inline-flex rounded bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-800">
                                            Read{log.openCount > 1 ? ` · ${log.openCount}x` : ''}
                                        </div>
                                    ) : (
                                        <div className="mt-1 text-[10px] text-slate-400">Unread</div>
                                    )}
                                    {log.exceptionMessage && (
                                        <div className="mt-1 max-w-[14rem] truncate text-xs text-red-600" title={log.exceptionMessage}>
                                            {log.exceptionMessage}
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="font-medium text-slate-900">{log.subject || '(no subject)'}</div>
                                    <div className="mt-0.5 text-xs text-slate-500">
                                        {log.to.length > 0 ? log.to.join(', ') : 'No recipients'}
                                    </div>
                                    <div className="mt-0.5 font-mono text-[11px] text-slate-400">{log.rid}</div>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-600">
                                    {log.mailableShort || log.notificationShort || '-'}
                                    <div className="mt-1 flex gap-1">
                                        {log.hasHtml && (
                                            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-700">
                                                HTML
                                            </span>
                                        )}
                                        {log.attachmentCount > 0 && (
                                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
                                                {log.attachmentCount} file{log.attachmentCount === 1 ? '' : 's'}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-slate-600">{log.mailer ?? '-'}</td>
                                <td className="px-4 py-3 text-slate-600">{formatBytes(log.sizeBytes)}</td>
                                <td className="px-4 py-3">
                                    <Link
                                        href={route('admin.email-logs.show', log.rid)}
                                        className="cursor-pointer text-indigo-700 underline"
                                    >
                                        Open
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        {logs.data.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                                    No email logs match these filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-4">
                <Pagination links={logs.links} />
            </div>
        </AdminLayout>
    );
}

function StatCard({
    label,
    value,
    tone,
}: {
    label: string;
    value: number;
    tone: 'emerald' | 'red' | 'amber' | 'slate';
}) {
    const tones = {
        emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
        red: 'border-red-200 bg-red-50 text-red-900',
        amber: 'border-amber-200 bg-amber-50 text-amber-950',
        slate: 'border-slate-200 bg-white text-slate-900',
    };

    return (
        <div className={`rounded-lg border px-4 py-3 ${tones[tone]}`}>
            <div className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block text-sm">
            <span className="mb-1 block text-slate-600">{label}</span>
            {children}
        </label>
    );
}
