import { Link, router, usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import { useRoute } from '@/utils/route';

type SharedProps = {
    auth?: {
        staff?: {
            permissions?: string[];
        } | null;
    };
};

type EventDetail = {
    rid: string;
    provider: string;
    externalEventId: string | null;
    eventType: string | null;
    payload: unknown;
    processedAt: string | null;
    createdAt: string | null;
};

type Props = {
    event: EventDetail;
    canReplay: boolean;
};

export default function Show({ event, canReplay }: Props) {
    const route = useRoute();
    const { auth } = usePage<SharedProps>().props;
    const canViewRequestLogs = Boolean(auth?.staff?.permissions?.includes('view_request_logs'));
    const payloadText =
        typeof event.payload === 'string'
            ? event.payload
            : JSON.stringify(event.payload, null, 2);

    return (
        <AdminLayout title="Webhook event">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <Link
                    href={route('admin.webhooks.index')}
                    className="cursor-pointer text-sm text-slate-600 underline"
                >
                    Back to webhooks
                </Link>
                {canReplay && (
                    <button
                        type="button"
                        className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
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

            <section className="mb-4 rounded-lg border border-slate-200 bg-white p-5 text-sm">
                <dl className="grid gap-2 sm:grid-cols-2">
                    <Row label="Rid" value={event.rid} />
                    <Row label="Provider" value={event.provider} />
                    <Row label="Event type" value={event.eventType ?? '-'} />
                    <Row label="External id" value={event.externalEventId ?? '-'} />
                    <Row
                        label="Processed"
                        value={
                            event.processedAt
                                ? new Date(event.processedAt).toLocaleString()
                                : 'Pending'
                        }
                    />
                    <Row
                        label="Created"
                        value={
                            event.createdAt
                                ? new Date(event.createdAt).toLocaleString()
                                : '-'
                        }
                    />
                    {canViewRequestLogs && (
                        <Row
                            label="Request history"
                            value={
                                <Link
                                    href={route('admin.request-history.entity', {
                                        entity_type: 'App\\Models\\PaymentWebhookEvent',
                                        entity_rid: event.rid,
                                    })}
                                    className="cursor-pointer underline"
                                >
                                    View related requests
                                </Link>
                            }
                        />
                    )}
                </dl>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5">
                <h2 className="mb-2 text-sm font-semibold">Payload</h2>
                <pre className="overflow-x-auto rounded-md bg-slate-50 p-3 text-xs text-slate-800">
                    {payloadText ?? 'null'}
                </pre>
            </section>
        </AdminLayout>
    );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="flex justify-between gap-4">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
        </div>
    );
}
