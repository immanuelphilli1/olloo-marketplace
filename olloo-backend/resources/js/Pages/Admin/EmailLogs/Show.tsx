import { useMemo, useState } from 'react';
import { Link } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import { useRoute } from '@/utils/route';
import EmailHtmlPreview from '@/Pages/Admin/EmailLogs/EmailHtmlPreview';

type Address = { address: string; name?: string | null };

type LogDetail = {
    rid: string;
    status: string;
    mailer: string | null;
    transport: string | null;
    subject: string | null;
    messageId: string | null;
    to: string[];
    from: Address[];
    cc: Address[];
    bcc: Address[];
    replyTo: Address[];
    mailableClass: string | null;
    mailableShort: string | null;
    notificationClass: string | null;
    notificationShort: string | null;
    hasHtml: boolean;
    htmlBody: string | null;
    textBody: string | null;
    headers: Record<string, string>;
    attachments: Array<{
        name: string;
        content_type?: string;
        size?: number;
        inline?: boolean;
    }>;
    sizeBytes: number | null;
    durationMs: number | null;
    locale: string | null;
    queue: string | null;
    guard: string | null;
    entityType: string | null;
    entityRid: string | null;
    exceptionClass: string | null;
    exceptionMessage: string | null;
    meta: unknown;
    isRead: boolean;
    readAt: string | null;
    lastOpenedAt: string | null;
    openCount: number;
    openHistory: Array<Record<string, unknown>>;
    queuedAt: string | null;
    sendingAt: string | null;
    sentAt: string | null;
    failedAt: string | null;
    createdAt: string | null;
    user: { rid: string; name: string; email: string } | null;
    previewUrl: string;
    downloadUrl: string;
};

type Props = {
    log: LogDetail;
};

type Tab = 'preview' | 'html' | 'text' | 'headers' | 'meta';

const STATUS_STYLES: Record<string, string> = {
    sent: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
    failed: 'bg-red-50 text-red-800 ring-red-600/20',
    sending: 'bg-amber-50 text-amber-900 ring-amber-600/20',
    queued: 'bg-slate-100 text-slate-700 ring-slate-500/20',
};

function formatAddresses(list: Address[]): string {
    if (!list.length) return '-';
    return list
        .map((a) => (a.name ? `${a.name} <${a.address}>` : a.address))
        .join(', ');
}

export default function Show({ log }: Props) {
    const route = useRoute();
    const [tab, setTab] = useState<Tab>('preview');
    const [copied, setCopied] = useState<string | null>(null);

    const tabs: { id: Tab; label: string }[] = useMemo(
        () => [
            { id: 'preview', label: 'Preview' },
            { id: 'html', label: 'HTML source' },
            { id: 'text', label: 'Plain text' },
            { id: 'headers', label: 'Headers' },
            { id: 'meta', label: 'Meta' },
        ],
        [],
    );

    const copy = async (label: string, value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(label);
            window.setTimeout(() => setCopied(null), 1500);
        } catch {
            setCopied(null);
        }
    };

    return (
        <AdminLayout title={log.subject || `Email ${log.rid}`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <Link
                    href={route('admin.email-logs.index')}
                    className="cursor-pointer text-sm text-slate-600 underline"
                >
                    Back to email logs
                </Link>
                <div className="flex flex-wrap gap-2">
                    <a
                        href={log.downloadUrl}
                        className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                    >
                        Download .eml
                    </a>
                    <button
                        type="button"
                        onClick={() => copy('rid', log.rid)}
                        className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                    >
                        {copied === 'rid' ? 'Copied rid' : 'Copy rid'}
                    </button>
                    {log.hasHtml && (
                        <button
                            type="button"
                            onClick={() => copy('html', log.htmlBody || '')}
                            className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                        >
                            {copied === 'html' ? 'Copied HTML' : 'Copy HTML'}
                        </button>
                    )}
                    <Link
                        href={route('admin.request-history.entity', {
                            entity_type: 'App\\Models\\EmailLog',
                            entity_rid: log.rid,
                        })}
                        className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                    >
                        Request history
                    </Link>
                </div>
            </div>

            <div className="mb-4 rounded-lg border border-slate-200 bg-white p-5">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">
                            {log.subject || '(no subject)'}
                        </h2>
                        <p className="mt-1 font-mono text-xs text-slate-400">{log.rid}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <span
                            className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[log.status] ?? STATUS_STYLES.queued}`}
                        >
                            {log.status}
                        </span>
                        <span
                            className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                                log.isRead
                                    ? 'bg-sky-50 text-sky-800 ring-sky-600/20'
                                    : 'bg-slate-100 text-slate-600 ring-slate-500/20'
                            }`}
                        >
                            {log.isRead ? `Read (${log.openCount} open${log.openCount === 1 ? '' : 's'})` : 'Unread'}
                        </span>
                    </div>
                </div>

                <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <Row label="From" value={formatAddresses(log.from)} />
                    <Row label="To" value={log.to.join(', ') || '-'} />
                    <Row label="Cc" value={formatAddresses(log.cc)} />
                    <Row label="Bcc" value={formatAddresses(log.bcc)} />
                    <Row label="Reply-To" value={formatAddresses(log.replyTo)} />
                    <Row label="Mailer" value={log.mailer ?? '-'} />
                    <Row label="Transport" value={log.transport ?? '-'} />
                    <Row label="Message-ID" value={log.messageId ?? '-'} />
                    <Row label="Mailable" value={log.mailableClass ?? '-'} mono />
                    <Row label="Notification" value={log.notificationClass ?? '-'} mono />
                    <Row
                        label="Created"
                        value={log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}
                    />
                    <Row
                        label="Sent"
                        value={log.sentAt ? new Date(log.sentAt).toLocaleString() : '-'}
                    />
                    <Row
                        label="First read"
                        value={log.readAt ? new Date(log.readAt).toLocaleString() : '-'}
                    />
                    <Row
                        label="Last opened"
                        value={log.lastOpenedAt ? new Date(log.lastOpenedAt).toLocaleString() : '-'}
                    />
                    <Row label="Open count" value={String(log.openCount)} />
                    <Row
                        label="Failed"
                        value={log.failedAt ? new Date(log.failedAt).toLocaleString() : '-'}
                    />
                    <Row
                        label="Duration"
                        value={log.durationMs != null ? `${log.durationMs} ms` : '-'}
                    />
                    <Row label="Locale" value={log.locale ?? '-'} />
                    <Row label="Queue" value={log.queue ?? '-'} />
                    {log.user && (
                        <Row label="Actor" value={`${log.user.name} (${log.user.email})`} />
                    )}
                </dl>

                {log.openHistory.length > 0 && (
                    <div className="mt-4">
                        <h3 className="mb-2 text-sm font-semibold">Open history</h3>
                        <ul className="space-y-2">
                            {log.openHistory.map((entry, index) => {
                                const openedAt =
                                    typeof entry.opened_at === 'string'
                                        ? new Date(entry.opened_at).toLocaleString()
                                        : `Open #${index + 1}`;
                                const ip = typeof entry.ip === 'string' ? entry.ip : null;
                                const ua = typeof entry.user_agent === 'string' ? entry.user_agent : null;
                                const detailPairs = Object.entries(entry).filter(
                                    ([key]) => !['opened_at', 'ip', 'user_agent'].includes(key),
                                );

                                return (
                                    <li
                                        key={`${openedAt}-${index}`}
                                        className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                                    >
                                        <div className="flex flex-wrap gap-x-3 gap-y-1 font-medium text-slate-900">
                                            <span>{openedAt}</span>
                                            {ip && <span className="font-mono">{ip}</span>}
                                        </div>
                                        {ua && (
                                            <p className="mt-1 break-all text-slate-600">{ua}</p>
                                        )}
                                        {detailPairs.length > 0 && (
                                            <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                                                {detailPairs.map(([key, value]) => (
                                                    <div key={key} className="min-w-0">
                                                        <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                                                            {key}
                                                        </dt>
                                                        <dd className="break-all font-mono text-[11px] text-slate-600">
                                                            {typeof value === 'string' || typeof value === 'number'
                                                                ? String(value)
                                                                : JSON.stringify(value)}
                                                        </dd>
                                                    </div>
                                                ))}
                                            </dl>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                {log.exceptionMessage && (
                    <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                        <div className="font-medium">{log.exceptionClass ?? 'Exception'}</div>
                        <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-xs">
                            {log.exceptionMessage}
                        </pre>
                    </div>
                )}

                {log.attachments.length > 0 && (
                    <div className="mt-4">
                        <h3 className="mb-2 text-sm font-semibold">Attachments</h3>
                        <ul className="space-y-1 text-sm text-slate-700">
                            {log.attachments.map((file, index) => (
                                <li key={`${file.name}-${index}`} className="flex gap-2">
                                    <span className="font-medium">{file.name}</span>
                                    <span className="text-slate-400">
                                        {file.content_type ?? 'unknown'}
                                        {file.size != null ? ` · ${file.size} B` : ''}
                                        {file.inline ? ' · inline' : ''}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-2">
                    {tabs.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setTab(item.id)}
                            className={`cursor-pointer rounded-md px-3 py-1.5 text-sm ${
                                tab === item.id
                                    ? 'bg-white font-medium text-slate-900 shadow-sm ring-1 ring-slate-200'
                                    : 'text-slate-600 hover:bg-white/70'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                <div className="p-4">
                    {tab === 'preview' && (
                        <EmailHtmlPreview
                            previewUrl={log.previewUrl}
                            hasHtml={log.hasHtml}
                            textFallback={log.textBody}
                        />
                    )}
                    {tab === 'html' && (
                        <SourcePane
                            empty={!log.htmlBody}
                            emptyLabel="No HTML body stored."
                            value={log.htmlBody || ''}
                            onCopy={() => copy('html', log.htmlBody || '')}
                            copied={copied === 'html'}
                        />
                    )}
                    {tab === 'text' && (
                        <SourcePane
                            empty={!log.textBody}
                            emptyLabel="No plain-text body stored."
                            value={log.textBody || ''}
                            onCopy={() => copy('text', log.textBody || '')}
                            copied={copied === 'text'}
                        />
                    )}
                    {tab === 'headers' && (
                        <SourcePane
                            empty={Object.keys(log.headers).length === 0}
                            emptyLabel="No headers stored."
                            value={Object.entries(log.headers)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join('\n')}
                            onCopy={() =>
                                copy(
                                    'headers',
                                    Object.entries(log.headers)
                                        .map(([k, v]) => `${k}: ${v}`)
                                        .join('\n'),
                                )
                            }
                            copied={copied === 'headers'}
                        />
                    )}
                    {tab === 'meta' && (
                        <SourcePane
                            empty={log.meta == null}
                            emptyLabel="No meta."
                            value={JSON.stringify(log.meta, null, 2)}
                            onCopy={() => copy('meta', JSON.stringify(log.meta, null, 2))}
                            copied={copied === 'meta'}
                        />
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}

function Row({
    label,
    value,
    mono = false,
}: {
    label: string;
    value: string;
    mono?: boolean;
}) {
    return (
        <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className={`mt-0.5 break-all text-slate-900 ${mono ? 'font-mono text-xs' : ''}`}>
                {value}
            </dd>
        </div>
    );
}

function SourcePane({
    value,
    empty,
    emptyLabel,
    onCopy,
    copied,
}: {
    value: string;
    empty: boolean;
    emptyLabel: string;
    onCopy: () => void;
    copied: boolean;
}) {
    if (empty) {
        return <p className="text-sm text-slate-500">{emptyLabel}</p>;
    }

    return (
        <div>
            <div className="mb-2 flex justify-end">
                <button
                    type="button"
                    onClick={onCopy}
                    className="cursor-pointer rounded-md border border-slate-300 px-2 py-1 text-xs"
                >
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <pre className="max-h-[70vh] overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
                {value}
            </pre>
        </div>
    );
}
