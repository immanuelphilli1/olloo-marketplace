import { useMemo, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import { useRoute } from '@/utils/route';

type Role = 'main' | 'sub' | 'undecided' | 'unmatched';

type FilePreview = {
    name: string;
    identifier: string;
    productName: string | null;
    matchedBy: string | null;
    role: Role;
    suggestedRole: 'main' | 'sub' | null;
    note: string;
};

type Props = {
    token: string;
    files: FilePreview[];
    summary: { total: number; matched: number; unmatched: number; undecided: number };
};

type SharedProps = { errors?: Record<string, string> };

export default function ImportImagesPreview({ token, files, summary }: Props) {
    const route = useRoute();
    const { errors } = usePage<SharedProps>().props;
    const [choices, setChoices] = useState<Record<string, 'main' | 'sub'>>({});
    const [submitting, setSubmitting] = useState(false);

    const visible = useMemo(() => files, [files]);
    const decidable = files.filter((file) => file.role === 'undecided');
    const applyable = files.filter((file) => file.role === 'main' || file.role === 'sub' || file.role === 'undecided');

    const apply = () => {
        setSubmitting(true);
        router.post(route('admin.products.import.images.apply', token), { choices }, {
            onFinish: () => setSubmitting(false),
        });
    };

    return (
        <AdminLayout title="Check your photos before saving">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <Link href={route('admin.products.index')} className="cursor-pointer text-sm text-slate-600 underline">
                    Back to products
                </Link>
                <Link href={route('admin.products.import.images')} className="cursor-pointer text-sm text-slate-600 underline">
                    Upload a different ZIP
                </Link>
            </div>

            <div className="mb-4 rounded-lg border border-slate-200 bg-white p-5">
                <h1 className="text-lg font-semibold text-slate-900">
                    {summary.total} {summary.total === 1 ? 'photo' : 'photos'} in your ZIP
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                    {summary.matched} match a product.{' '}
                    {summary.unmatched > 0 && `${summary.unmatched} do not match anything and will be skipped. `}
                    {summary.undecided > 0 &&
                        `${summary.undecided} need to know whether they are the main photo or a gallery photo.`}
                </p>
            </div>

            {errors?.images && (
                <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
                    {errors.images}
                </div>
            )}

            {decidable.length > 0 && (
                <section className="mb-4 rounded-lg border border-sky-300 bg-sky-50 p-5">
                    <h2 className="text-base font-semibold text-slate-900">
                        Choose which photo is the main one
                    </h2>
                    <p className="mt-1 text-sm text-slate-700">
                        For each of these, say whether it should replace the main photo or join the gallery. We have
                        pre-selected our guess; change it if that is not what you meant.
                    </p>

                    <ul className="mt-3 divide-y divide-sky-200">
                        {decidable.map((file) => (
                            <li key={file.name} className="flex flex-wrap items-center justify-between gap-3 py-2">
                                <div className="min-w-0">
                                    <p className="font-medium text-slate-900">{file.name}</p>
                                    <p className="text-xs text-slate-600">
                                        {file.productName}
                                        {file.matchedBy ? ` · matched by ${file.matchedBy.toLowerCase()}` : ''}
                                    </p>
                                </div>
                                <div
                                    role="radiogroup"
                                    aria-label={`What to do with ${file.name}`}
                                    className="flex shrink-0 gap-4"
                                >
                                    {(['main', 'sub'] as const).map((role) => (
                                        <label key={role} className="flex cursor-pointer items-center gap-2 text-sm">
                                            <input
                                                type="radio"
                                                name={`role-${file.name}`}
                                                checked={(choices[file.name] ?? file.suggestedRole) === role}
                                                onChange={() => setChoices((prev) => ({ ...prev, [file.name]: role }))}
                                                className="cursor-pointer"
                                            />
                                            {role === 'main' ? 'Main photo' : 'Gallery photo'}
                                        </label>
                                    ))}
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                            <th className="px-4 py-3 font-medium">File</th>
                            <th className="px-4 py-3 font-medium">Goes to</th>
                            <th className="px-4 py-3 font-medium">What happens</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((file) => (
                            <tr
                                key={file.name}
                                className={`border-b border-slate-100 last:border-0 ${
                                    file.role === 'unmatched' ? 'bg-amber-50' : ''
                                }`}
                            >
                                <td className="px-4 py-3 font-mono text-xs text-slate-700">{file.name}</td>
                                <td className="px-4 py-3">
                                    {file.productName ? (
                                        <>
                                            <div className="text-slate-900">{file.productName}</div>
                                            {file.matchedBy && (
                                                <div className="text-xs text-slate-500">
                                                    matched by {file.matchedBy.toLowerCase()}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-amber-800">No matching product</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-slate-600">{file.note}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    disabled={submitting || applyable.length === 0}
                    onClick={apply}
                    className="cursor-pointer rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {submitting
                        ? 'Queueing…'
                        : `Apply ${applyable.length} ${applyable.length === 1 ? 'photo' : 'photos'}`}
                </button>
                <Link
                    href={route('admin.products.index')}
                    className="cursor-pointer rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                    Cancel
                </Link>
            </div>
        </AdminLayout>
    );
}