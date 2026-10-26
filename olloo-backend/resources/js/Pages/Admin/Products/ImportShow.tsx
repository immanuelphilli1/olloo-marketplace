import { useEffect } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import { Badge } from '@/Components/Form';
import { formatDateTime } from '@/Components/PaymentStatus';
import { useRoute } from '@/utils/route';

type ReportRow = {
    name: string;
    line: number | null;
    outcome: 'created' | 'applied' | 'updated' | 'skipped' | 'failed';
    note: string | null;
    productRid: string | null;
};

type ImportRun = {
    rid: string;
    kind: 'csv' | 'images';
    filename: string;
    status: 'queued' | 'running' | 'done' | 'failed';
    summary: string;
    error: string | null;
    duration: string;
    isFinished: boolean;
    report: ReportRow[];
    createdAt: string | null;
    finishedAt: string | null;
};

type Props = {
    import: ImportRun;
    canCreate: boolean;
    workerRunning: boolean;
};

const STATUS: Record<string, { label: string; tone: 'slate' | 'green' | 'amber' | 'sky' | 'red' }> = {
    queued: { label: 'Waiting to start', tone: 'slate' },
    running: { label: 'Working now', tone: 'amber' },
    done: { label: 'Finished', tone: 'green' },
    failed: { label: 'Stopped early', tone: 'red' },
};

const OUTCOME_TONE: Record<ReportRow['outcome'], 'green' | 'amber' | 'red' | 'slate'> = {
    created: 'green',
    applied: 'green',
    updated: 'green',
    skipped: 'amber',
    failed: 'red',
};

const OUTCOME_LABEL: Record<ReportRow['outcome'], string> = {
    created: 'Created',
    applied: 'Applied',
    updated: 'Updated',
    skipped: 'Skipped',
    failed: 'Could not be saved',
};

/**
 * Polls while the import is in flight and stops for good once it finishes, so a
 * tab left open overnight does not keep hitting the server.
 */
function usePollingWhileRunning(importRun: ImportRun, workerRunning: boolean) {
    useEffect(() => {
        // Nothing can change until a worker picks it up, so do not keep asking.
        if (importRun.isFinished || !workerRunning) return;

        const timer = window.setInterval(() => {
            router.reload({ only: ['import'], preserveUrl: true });
        }, 3000);

        return () => window.clearInterval(timer);
    }, [importRun.isFinished, workerRunning]);
}

export default function ImportShow({ import: importRun, canCreate, workerRunning }: Props) {
    const route = useRoute();
    usePollingWhileRunning(importRun, workerRunning);

    const status = STATUS[importRun.status] ?? STATUS.queued;
    const problems = importRun.report.filter((row) => row.outcome === 'failed' || row.outcome === 'skipped');
    const successes = importRun.report.filter((row) => row.outcome !== 'failed' && row.outcome !== 'skipped');

    return (
        <AdminLayout title={importRun.kind === 'csv' ? 'Product import' : 'Photo import'}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <Link href={route('admin.products.index')} className="cursor-pointer text-sm text-slate-600 underline">
                    Back to products
                </Link>
                <Link href={route('admin.products.import.index')} className="cursor-pointer text-sm text-slate-600 underline">
                    All imports
                </Link>
            </div>

            <section className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <Badge tone={status.tone}>{status.label}</Badge>
                            <span className="text-sm text-slate-500">
                                from {importRun.filename} · started {formatDateTime(importRun.createdAt)}
                            </span>
                        </div>
                        <h1 className="mt-2 text-xl font-semibold text-slate-900">{importRun.summary}</h1>
                        <p className="mt-1 text-sm text-slate-600">Took {importRun.duration}.</p>
                    </div>
                </div>

                {!importRun.isFinished && (
                    <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                        {workerRunning ? (
                            <>
                                This is running in the background. You can leave this page and come back later: it
                                will keep working and the result is saved on the All imports page.
                            </>
                        ) : (
                            <>
                                Nothing will process this until a background worker is running. Ask whoever looks after
                                this site to start it, then reload this page.
                            </>
                        )}
                    </p>
                )}

                {importRun.error && (
                    <div role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                        {importRun.error}
                    </div>
                )}
            </section>

            {successes.length > 0 && (
                <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
                    <h2 className="text-base font-semibold text-slate-900">
                        {successes.length === 1 ? '1 item was saved' : `${successes.length} items were saved`}
                    </h2>
                    <ul className="mt-3 divide-y divide-slate-100">
                        {successes.map((row, index) => (
                            <li key={`${row.name}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                                <span className="text-sm text-slate-900">{row.name}</span>
                                <Badge tone={OUTCOME_TONE[row.outcome]}>{OUTCOME_LABEL[row.outcome]}</Badge>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {problems.length > 0 && (
                <section className="mt-4 rounded-lg border border-amber-300 bg-white p-5">
                    <h2 className="text-base font-semibold text-slate-900">
                        {problems.length === 1 ? '1 item needs attention' : `${problems.length} items need attention`}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                        These did not change anything. Fix them and upload the file again.
                    </p>
                    <ul className="mt-3 divide-y divide-slate-100">
                        {problems.map((row, index) => (
                            <li key={`${row.name}-${index}`} className="py-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-sm font-medium text-slate-900">{row.name}</span>
                                    <Badge tone={OUTCOME_TONE[row.outcome]}>{OUTCOME_LABEL[row.outcome]}</Badge>
                                </div>
                                {row.note && <p className="mt-1 text-sm text-slate-600">{row.note}</p>}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {importRun.isFinished && canCreate && (
                <div className="mt-5 flex gap-3">
                    {importRun.kind === 'csv' ? (
                        <Link
                            href={route('admin.products.import.csv')}
                            className="cursor-pointer rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
                        >
                            Import another file
                        </Link>
                    ) : (
                        <Link
                            href={route('admin.products.import.images')}
                            className="cursor-pointer rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
                        >
                            Upload more photos
                        </Link>
                    )}
                </div>
            )}
        </AdminLayout>
    );
}