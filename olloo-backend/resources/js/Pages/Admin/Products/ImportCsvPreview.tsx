import { useMemo, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import { ErrorSummary } from '@/Components/Form';
import { useRoute } from '@/utils/route';

type VariantPreview = { name: string; sku: string; price: string | null; stock: number | null };

type RowPreview = {
    index: number;
    line: number;
    name: string;
    slug: string;
    action: 'create' | 'update' | 'invalid';
    matchedBy: string | null;
    existingName: string | null;
    variants: VariantPreview[];
    errors: string[];
    warnings: string[];
    changes: Array<{ field: string; from: string | null; to: string | null }>;
};

type Props = {
    token: string;
    filename: string;
    rows: RowPreview[];
    summary: { total: number; create: number; update: number; invalid: number };
    matched: Array<{ index: number; name: string; matchedBy: string | null }>;
};

type SharedProps = { errors?: Record<string, string> };

type Choice = 'update' | 'skip';

export default function ImportCsvPreview({ token, filename, rows, summary, matched }: Props) {
    const route = useRoute();
    const { errors } = usePage<SharedProps>().props;
    const [choices, setChoices] = useState<Record<number, Choice>>({});
    const [filter, setFilter] = useState<'all' | 'create' | 'update' | 'invalid'>('all');
    const [submitting, setSubmitting] = useState(false);

    const visible = useMemo(
        () => rows.filter((row) => filter === 'all' || row.action === filter),
        [rows, filter],
    );

    const importable = rows.filter((row) => row.action === 'create').length;
    const unanswered = matched.filter((row) => !choices[row.index]);

    const apply = () => {
        setSubmitting(true);
        router.post(
            route('admin.products.import.csv.apply', token),
            { choices },
            {
                onFinish: () => setSubmitting(false),
            },
        );
    };

    const chooseAll = (choice: Choice) => {
        const next: Record<number, Choice> = { ...choices };
        matched.forEach((row) => {
            next[row.index] = choice;
        });
        setChoices(next);
    };

    return (
        <AdminLayout title="Check your products before saving">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <Link href={route('admin.products.index')} className="cursor-pointer text-sm text-slate-600 underline">
                    Back to products
                </Link>
                <Link href={route('admin.products.import.csv')} className="cursor-pointer text-sm text-slate-600 underline">
                    Upload a different file
                </Link>
            </div>

            <div className="mb-4 rounded-lg border border-slate-200 bg-white p-5">
                <h1 className="text-lg font-semibold text-slate-900">Here is what will happen with {filename}</h1>
                <p className="mt-1 text-sm text-slate-600">
                    {summary.total} {summary.total === 1 ? 'row' : 'rows'} read.{' '}
                    {summary.create > 0 && `${summary.create} will be created. `}
                    {summary.update > 0 && `${summary.update} already exist and need your decision. `}
                    {summary.invalid > 0 && `${summary.invalid} cannot be imported.`}
                </p>
            </div>

            {errors?.choices && (
                <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
                    {errors.choices}
                </div>
            )}

            {summary.invalid > 0 && (
                <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-semibold">{summary.invalid} rows have problems and will be skipped.</p>
                    <p className="mt-1">
                        Fix them in your spreadsheet and upload the file again, or import the rest now and add those
                        products by hand later.
                    </p>
                </div>
            )}

            {matched.length > 0 && (
                <section className="mb-4 rounded-lg border border-sky-300 bg-sky-50 p-5">
                    <h2 className="text-base font-semibold text-slate-900">
                        {matched.length} {matched.length === 1 ? 'row matches' : 'rows match'} a product that already
                        exists
                    </h2>
                    <p className="mt-1 text-sm text-slate-700">
                        Choose what to do with each one. Skip is safer if you are not sure.
                    </p>

                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            onClick={() => chooseAll('update')}
                            className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
                        >
                            Update all
                        </button>
                        <button
                            type="button"
                            onClick={() => chooseAll('skip')}
                            className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
                        >
                            Skip all
                        </button>
                    </div>

                    <ul className="mt-3 divide-y divide-sky-200">
                        {matched.map((row) => (
                            <li key={row.index} className="flex flex-wrap items-center justify-between gap-3 py-2">
                                <div className="min-w-0">
                                    <p className="font-medium text-slate-900">{row.name}</p>
                                    {row.matchedBy && <p className="text-xs text-slate-600">{row.matchedBy}</p>}
                                </div>
                                <div
                                    role="radiogroup"
                                    aria-label={`What to do with ${row.name}`}
                                    className="flex shrink-0 gap-4"
                                >
                                    {(['update', 'skip'] as const).map((choice) => (
                                        <label key={choice} className="flex cursor-pointer items-center gap-2 text-sm">
                                            <input
                                                type="radio"
                                                name={`choice-${row.index}`}
                                                checked={choices[row.index] === choice}
                                                onChange={() => setChoices((prev) => ({ ...prev, [row.index]: choice }))}
                                                className="cursor-pointer"
                                            />
                                            {choice === 'update' ? 'Update it' : 'Skip it'}
                                        </label>
                                    ))}
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <div className="mb-3 flex flex-wrap gap-2">
                {(
                    [
                        ['all', `All ${rows.length}`],
                        ['create', `New ${summary.create}`],
                        ['update', `Existing ${summary.update}`],
                        ['invalid', `Problems ${summary.invalid}`],
                    ] as const
                ).map(([value, label]) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setFilter(value)}
                        className={`cursor-pointer rounded-full px-3 py-1 text-sm ${
                            filter === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div className="space-y-3">
                {visible.map((row) => (
                    <section
                        key={row.index}
                        className={`rounded-lg border bg-white p-4 ${
                            row.action === 'invalid' ? 'border-amber-300' : 'border-slate-200'
                        }`}
                    >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                                <h3 className="font-medium text-slate-900">{row.name}</h3>
                                <p className="text-xs text-slate-500">row {row.line} of your file</p>
                                <p className="text-sm text-slate-600">
                                    {row.action === 'create' && 'New product'}
                                    {row.action === 'update' &&
                                        (choices[row.index] === 'update' ? 'Will update' : 'Will skip') +
                                            ` ${row.existingName ?? ''}`}
                                    {row.action === 'invalid' && 'Cannot be imported'}
                                </p>
                            </div>
                            {row.matchedBy && row.action === 'update' && (
                                <p className="text-xs text-slate-500">{row.matchedBy}</p>
                            )}
                        </div>

                        {row.errors.length > 0 && (
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
                                {row.errors.map((error) => (
                                    <li key={error}>{error}</li>
                                ))}
                            </ul>
                        )}

                        {row.warnings.length > 0 && (
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
                                {row.warnings.map((warning) => (
                                    <li key={warning}>{warning}</li>
                                ))}
                            </ul>
                        )}

                        {row.changes.length > 0 && (
                            <details className="mt-3">
                                <summary className="cursor-pointer text-sm font-medium text-slate-700">
                                    {row.changes.length} {row.changes.length === 1 ? 'change' : 'changes'}
                                </summary>
                                <table className="mt-2 w-full text-left text-sm">
                                    <tbody>
                                        {row.changes.map((change) => (
                                            <tr key={change.field} className="border-b border-slate-100 last:border-0">
                                                <td className="w-40 py-1 text-slate-500">{change.field}</td>
                                                <td className="py-1">
                                                    {change.from === null ? (
                                                        <span className="text-slate-400">not set</span>
                                                    ) : (
                                                        <span className="text-slate-500 line-through">{change.from}</span>
                                                    )}
                                                </td>
                                                <td className="py-1 font-medium text-slate-900">{change.to}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </details>
                        )}

                        {row.variants.length > 0 && (
                            <div className="mt-3">
                                <p className="text-xs font-medium text-slate-500">
                                    {row.variants.length} {row.variants.length === 1 ? 'option' : 'options'}
                                </p>
                                <ul className="mt-1 flex flex-wrap gap-2">
                                    {row.variants.map((variant) => (
                                        <li key={variant.sku} className="rounded border border-slate-200 px-2 py-1 text-xs">
                                            {variant.name} · {variant.sku}
                                            {variant.stock !== null && ` · ${variant.stock} in stock`}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </section>
                ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    disabled={submitting || importable === 0 || unanswered.length > 0}
                    onClick={apply}
                    className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {submitting
                        ? 'Queueing…'
                        : `Import ${importable} ${importable === 1 ? 'product' : 'products'}`}
                </button>
                <Link
                    href={route('admin.products.index')}
                    className="cursor-pointer rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                    Cancel
                </Link>
                {unanswered.length > 0 && (
                    <p className="text-sm text-amber-800">
                        Choose Update or Skip for {unanswered.length} of the existing{' '}
                        {unanswered.length === 1 ? 'product' : 'products'} first.
                    </p>
                )}
            </div>
        </AdminLayout>
    );
}