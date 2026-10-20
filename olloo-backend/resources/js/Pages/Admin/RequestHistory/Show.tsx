import { Link } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import { useRoute } from '@/utils/route';

type LogDetail = {
    rid: string;
    direction: string;
    service: string;
    action: string | null;
    requestMethod: string | null;
    requestUrl: string | null;
    statusCode: number | null;
    success: boolean | null;
    durationMs: number | null;
    exceptionClass: string | null;
    exceptionMessage: string | null;
    guard: string | null;
    meta: unknown;
    createdAt: string | null;
    user: { rid: string; name: string; email: string } | null;
    entities: Array<{ entityType: string; entityRid: string }>;
    requestHeaders?: unknown;
    requestBody?: string | null;
    responseHeaders?: unknown;
    responseBody?: string | null;
};

type Props = {
    log: LogDetail;
};

export default function Show({ log }: Props) {
    const route = useRoute();

    return (
        <AdminLayout title="Request log">
            <div className="mb-4">
                <Link
                    href={route('admin.request-history.index')}
                    className="cursor-pointer text-sm text-slate-600 underline"
                >
                    Back to request history
                </Link>
            </div>

            <div className="space-y-4">
                <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
                    <h2 className="mb-3 font-semibold">Summary</h2>
                    <dl className="grid gap-2 sm:grid-cols-2">
                        <Row label="Rid" value={log.rid} />
                        <Row label="Direction" value={log.direction} />
                        <Row label="Service" value={log.service} />
                        <Row label="Action" value={log.action ?? '-'} />
                        <Row label="Method" value={log.requestMethod ?? '-'} />
                        <Row label="Status" value={String(log.statusCode ?? '-')} />
                        <Row
                            label="Success"
                            value={
                                log.success === null ? '-' : log.success ? 'yes' : 'no'
                            }
                        />
                        <Row
                            label="Duration"
                            value={log.durationMs != null ? `${log.durationMs} ms` : '-'}
                        />
                        <Row
                            label="Created"
                            value={
                                log.createdAt
                                    ? new Date(log.createdAt).toLocaleString()
                                    : '-'
                            }
                        />
                        <Row label="Guard" value={log.guard ?? '-'} />
                    </dl>
                    {log.requestUrl && (
                        <p className="mt-3 break-all text-slate-600">{log.requestUrl}</p>
                    )}
                    {log.exceptionMessage && (
                        <p className="mt-3 text-red-600">
                            {log.exceptionClass ? `${log.exceptionClass}: ` : ''}
                            {log.exceptionMessage}
                        </p>
                    )}
                </section>

                {log.user && (
                    <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
                        <h2 className="mb-2 font-semibold">User</h2>
                        <p>
                            {log.user.name} ({log.user.email}) · {log.user.rid}
                        </p>
                    </section>
                )}

                {log.entities.length > 0 && (
                    <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
                        <h2 className="mb-2 font-semibold">Entities</h2>
                        <ul className="space-y-1">
                            {log.entities.map((entity) => (
                                <li key={`${entity.entityType}:${entity.entityRid}`}>
                                    <Link
                                        href={route('admin.request-history.entity', {
                                            entity_type: entity.entityType,
                                            entity_rid: entity.entityRid,
                                        })}
                                        className="cursor-pointer underline"
                                    >
                                        {entity.entityType} · {entity.entityRid}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <JsonBlock title="Request headers" value={log.requestHeaders} />
                <TextBlock title="Request body" value={log.requestBody} />
                <JsonBlock title="Response headers" value={log.responseHeaders} />
                <TextBlock title="Response body" value={log.responseBody} />
                <JsonBlock title="Meta" value={log.meta} />
            </div>
        </AdminLayout>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-4">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
        </div>
    );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
    if (value == null) {
        return null;
    }

    const text =
        typeof value === 'string'
            ? value
            : JSON.stringify(value, null, 2);

    return (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-2 text-sm font-semibold">{title}</h2>
            <pre className="overflow-x-auto rounded-md bg-slate-50 p-3 text-xs text-slate-800">
                {text}
            </pre>
        </section>
    );
}

function TextBlock({ title, value }: { title: string; value?: string | null }) {
    if (value == null || value === '') {
        return null;
    }

    return (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-2 text-sm font-semibold">{title}</h2>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-800">
                {value}
            </pre>
        </section>
    );
}
