import { Link } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import { Badge } from '@/Components/Form';
import { formatDateTime } from '@/Components/PaymentStatus';
import { useRoute } from '@/utils/route';

type ImportRun = {
    rid: string;
    kind: 'csv' | 'images';
    filename: string;
    status: 'queued' | 'running' | 'done' | 'failed';
    summary: string;
    error: string | null;
    duration: string;
    isFinished: boolean;
    createdAt: string | null;
};

type Props = { imports: ImportRun[] };

const STATUS: Record<string, { label: string; tone: 'slate' | 'green' | 'amber' | 'red' }> = {
    queued: { label: 'Waiting to start', tone: 'slate' },
    running: { label: 'Working now', tone: 'amber' },
    done: { label: 'Finished', tone: 'green' },
    failed: { label: 'Stopped early', tone: 'red' },
};

export default function ImportIndex({ imports }: Props) {
    const route = useRoute();

    return (
        <AdminLayout title="Product imports">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <Link href={route('admin.products.index')} className="cursor-pointer text-sm text-slate-600 underline">
                    Back to products
                </Link>
                <div className="flex gap-2">
                    <Link
                        href={route('admin.products.import.csv')}
                        className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        Add from spreadsheet
                    </Link>
                    <Link
                        href={route('admin.products.import.images')}
                        className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        Add photos
                    </Link>
                </div>
            </div>

            <p className="mb-4 text-sm text-slate-600">
                Every upload you have started, and what it did. Imports run in the background, so a large file does not
                block your browser.
            </p>

            {imports.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                    You have not uploaded a file yet.
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <table className="min-w-full text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                            <tr>
                                <th className="px-4 py-3 font-medium">What</th>
                                <th className="px-4 py-3 font-medium">File</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Result</th>
                                <th className="px-4 py-3 font-medium">Started</th>
                            </tr>
                        </thead>
                        <tbody>
                            {imports.map((entry) => {
                                const status = STATUS[entry.status] ?? STATUS.queued;

                                return (
                                    <tr key={entry.rid} className="border-b border-slate-100 last:border-0">
                                        <td className="px-4 py-3">
                                            {entry.kind === 'csv' ? 'Product details' : 'Product photos'}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{entry.filename}</td>
                                        <td className="px-4 py-3">
                                            <Badge tone={status.tone}>{status.label}</Badge>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Link
                                                href={route('admin.products.import.show', entry.rid)}
                                                className="cursor-pointer underline"
                                            >
                                                {entry.summary}
                                            </Link>
                                            {entry.error && (
                                                <div className="text-xs text-red-700">{entry.error}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{formatDateTime(entry.createdAt)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </AdminLayout>
    );
}