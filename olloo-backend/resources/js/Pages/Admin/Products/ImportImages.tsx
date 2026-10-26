import { useRef, useState } from 'react';
import { Link, useForm } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import { ErrorSummary, FormSection, inputClass } from '@/Components/Form';
import { useRoute } from '@/utils/route';

type Example = { file: string; maps: string; effect: string };

type Props = {
    examples: Example[];
    maxFiles: number;
};

export default function ImportImages({ examples, maxFiles }: Props) {
    const route = useRoute();
    const fileRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState('');

    const form = useForm<{ images: File | null }>({ images: null });

    const submit = () => {
        if (!form.data.images) return;

        form.post(route('admin.products.import.images.preview'), {
            forceFormData: true,
            preserveScroll: true,
        });
    };

    return (
        <AdminLayout title="Add photos to many products at once">
            <div className="mb-4">
                <Link href={route('admin.products.index')} className="cursor-pointer text-sm text-slate-600 underline">
                    Back to products
                </Link>
            </div>

            <div className="space-y-4">
                <FormSection
                    title="Name each photo after its product"
                    hasError={false}
                    description="Put your images in a folder, then name each file after the product it belongs to. We work out which product that is for you."
                >
                    <p className="text-sm text-slate-700">
                        A file name can use the product&rsquo;s store link, its product reference, or the SKU of any of
                        its options. Any of the three works.
                    </p>

                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="min-w-full text-left text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                                <tr>
                                    <th className="px-3 py-2 font-medium">If you name the file</th>
                                    <th className="px-3 py-2 font-medium">It goes to</th>
                                    <th className="px-3 py-2 font-medium">And it</th>
                                </tr>
                            </thead>
                            <tbody>
                                {examples.map((example) => (
                                    <tr key={example.file} className="border-b border-slate-100 last:border-0">
                                        <td className="px-3 py-2 font-mono text-xs text-slate-700">{example.file}</td>
                                        <td className="px-3 py-2 text-slate-600">{example.maps}</td>
                                        <td className="px-3 py-2 text-slate-600">{example.effect}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <p className="text-sm text-slate-600">
                        Two photos with no <span className="font-mono text-xs">main-</span> or{' '}
                        <span className="font-mono text-xs">sub-</span> in the name means we cannot tell which one you
                        want as the main photo, so you will be asked on the next screen.
                    </p>
                </FormSection>

                <FormSection
                    title="Upload your ZIP"
                    hasError={Object.keys(form.errors).length > 0}
                    description={`A ZIP file containing up to ${maxFiles} JPEG, PNG or WebP images.`}
                >
                    <ErrorSummary
                        fields={[{ key: 'images', label: 'the ZIP file', section: 'upload' }]}
                        errors={form.errors}
                        noun="the ZIP file"
                    />

                    <div className="text-sm">
                        <label htmlFor="field-images" className="mb-1 block font-medium text-slate-700">
                            ZIP file
                        </label>
                        <input
                            id="field-images"
                            ref={fileRef}
                            type="file"
                            accept=".zip,application/zip"
                            aria-invalid={Boolean(form.errors.images)}
                            className={inputClass(form.errors.images, 'w-full cursor-pointer')}
                            onChange={(e) => {
                                const file = e.target.files?.[0] ?? null;
                                setFileName(file?.name ?? '');
                                form.setData('images', file);
                            }}
                        />
                        {fileName && <p className="mt-1 text-slate-500">Selected: {fileName}</p>}
                        {form.errors.images && <p className="mt-1 text-sm text-red-600">{form.errors.images}</p>}
                    </div>

                    <button
                        type="button"
                        disabled={!form.data.images || form.processing}
                        onClick={submit}
                        className="cursor-pointer rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {form.processing ? 'Reading the ZIP…' : 'Check my photos'}
                    </button>
                </FormSection>
            </div>
        </AdminLayout>
    );
}