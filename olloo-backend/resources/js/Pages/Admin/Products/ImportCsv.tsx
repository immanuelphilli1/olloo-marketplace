import { useRef, useState } from 'react';
import { Link, router, useForm } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import { ErrorSummary, FormSection, inputClass } from '@/Components/Form';
import { useRoute } from '@/utils/route';

type Column = { key: string; label: string };

type Props = {
    columns: Column[];
    maxRows: number;
};

export default function ImportCsv({ columns, maxRows }: Props) {
    const route = useRoute();
    const fileRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState('');

    const form = useForm<{ csv: File | null }>({ csv: null });

    const submit = () => {
        if (!form.data.csv) return;

        form.post(route('admin.products.import.csv.preview'), {
            forceFormData: true,
            preserveScroll: true,
        });
    };

    return (
        <AdminLayout title="Add products from a spreadsheet">
            <div className="mb-4">
                <Link href={route('admin.products.index')} className="cursor-pointer text-sm text-slate-600 underline">
                    Back to products
                </Link>
            </div>

            <div className="space-y-4">
                <FormSection
                    title="How this works"
                    hasError={false}
                    description="You upload a spreadsheet, look at exactly what will change, then press one button to save it. Nothing is saved until you press it."
                >
                    <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
                        <li>
                            <a
                                href={route('admin.products.import.csv.template')}
                                className="cursor-pointer font-medium underline"
                            >
                                Download the template
                            </a>{' '}
                            and fill it in a spreadsheet program such as Excel or Google Sheets.
                        </li>
                        <li>Upload the file below. You will see a preview of every row and what it will do.</li>
                        <li>For any product that already exists, choose whether to update it or skip it.</li>
                        <li>Press Import to save.</li>
                    </ol>
                </FormSection>

                <FormSection
                    title="What goes in each column"
                    hasError={false}
                    description="Only Product name, Category and Price are required. Leave the rest blank and we keep it simple for you."
                >
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="min-w-full text-left text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                                <tr>
                                    <th className="px-3 py-2 font-medium">Column</th>
                                    <th className="px-3 py-2 font-medium">What to put in it</th>
                                </tr>
                            </thead>
                            <tbody>
                                {columns.map((column) => (
                                    <tr key={column.key} className="border-b border-slate-100 last:border-0">
                                        <td className="px-3 py-2 font-mono text-xs text-slate-700">{column.key}</td>
                                        <td className="px-3 py-2 text-slate-600">{column.label}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-sm text-slate-600">
                        To add more sizes or colours of one product, put them on extra rows with the same store link
                        and a different SKU. Up to {maxRows.toLocaleString()} rows per file.
                    </p>
                </FormSection>

                <FormSection
                    title="Upload your file"
                    hasError={Object.keys(form.errors).length > 0}
                    description="A .csv file you exported from your spreadsheet."
                >
                    <ErrorSummary
                        fields={[{ key: 'csv', label: 'the file', section: 'upload' }]}
                        errors={form.errors}
                        noun="the file"
                    />

                    <div className="text-sm">
                        <label htmlFor="field-csv" className="mb-1 block font-medium text-slate-700">
                            Spreadsheet file
                        </label>
                        <input
                            id="field-csv"
                            ref={fileRef}
                            type="file"
                            accept=".csv,text/csv"
                            aria-invalid={Boolean(form.errors.csv)}
                            className={inputClass(form.errors.csv, 'w-full cursor-pointer')}
                            onChange={(e) => {
                                const file = e.target.files?.[0] ?? null;
                                setFileName(file?.name ?? '');
                                form.setData('csv', file);
                            }}
                        />
                        {fileName && <p className="mt-1 text-slate-500">Selected: {fileName}</p>}
                        {form.errors.csv && <p className="mt-1 text-sm text-red-600">{form.errors.csv}</p>}
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            disabled={!form.data.csv || form.processing}
                            onClick={submit}
                            className="cursor-pointer rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {form.processing ? 'Reading the file…' : 'Preview my file'}
                        </button>
                        <button
                            type="button"
                            onClick={() => router.reload({ only: [] })}
                            className="cursor-pointer rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                            Start over
                        </button>
                    </div>
                </FormSection>
            </div>
        </AdminLayout>
    );
}