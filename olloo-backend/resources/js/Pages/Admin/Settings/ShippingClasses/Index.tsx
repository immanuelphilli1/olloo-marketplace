import { FormEvent, useState } from 'react';
import { Link, router, useForm } from '@inertiajs/react';
import AdminLayout from '../../Layouts/AdminLayout';
import { inputClass } from '@/Components/Form';
import { useRoute } from '@/utils/route';

type ShippingClassRow = {
    rid: string;
    name: string;
    productsCount: number;
    rulesCount: number;
};

export default function Index({ classes }: { classes: ShippingClassRow[] }) {
    const route = useRoute();
    const [renaming, setRenaming] = useState<string | null>(null);
    const create = useForm({ name: '' });

    const add = (event: FormEvent) => {
        event.preventDefault();
        create.post(route('admin.shipping-classes.store'), { preserveScroll: true, onSuccess: () => create.reset() });
    };

    return (
        <AdminLayout title="Shipping classes">
            <p className="mb-4 max-w-2xl text-sm text-slate-600">
                Group products that ship differently, such as bulky furniture. Give a class its own{' '}
                <Link href={route('admin.shipping-rules.index')} className="cursor-pointer underline underline-offset-2 hover:text-slate-900">
                    shipping rules
                </Link>
                , then pick it on those products. Products without a class ship as standard.
            </p>

            <form onSubmit={add} className="mb-4 flex flex-wrap items-start gap-2">
                <div>
                    <label htmlFor="new-class" className="sr-only">
                        New shipping class name
                    </label>
                    <input
                        id="new-class"
                        type="text"
                        value={create.data.name}
                        onChange={(e) => create.setData('name', e.target.value)}
                        aria-invalid={Boolean(create.errors.name)}
                        className={inputClass(create.errors.name, 'w-64')}
                        placeholder="Bulky"
                        maxLength={80}
                    />
                    {create.errors.name && <p className="mt-1 text-sm text-red-600">{create.errors.name}</p>}
                </div>
                <button
                    type="submit"
                    disabled={create.processing}
                    className="cursor-pointer rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                    Add class
                </button>
            </form>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                            <th className="px-4 py-3 font-medium">Class</th>
                            <th className="px-4 py-3 font-medium">Products</th>
                            <th className="px-4 py-3 font-medium">Rules</th>
                            <th className="px-4 py-3 font-medium">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-slate-100 text-slate-500">
                            <td className="px-4 py-3">Standard</td>
                            <td className="px-4 py-3" colSpan={3}>
                                Built in. Products without a class use the shipping rules that have no class.
                            </td>
                        </tr>
                        {classes.map((row) =>
                            renaming === row.rid ? (
                                <RenameRow key={row.rid} row={row} onDone={() => setRenaming(null)} />
                            ) : (
                                <tr key={row.rid} className="border-b border-slate-100 last:border-0">
                                    <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                                    <td className="px-4 py-3">{row.productsCount}</td>
                                    <td className="px-4 py-3">
                                        {row.rulesCount === 0 ? (
                                            <span className="text-amber-700">None yet: standard rules apply</span>
                                        ) : (
                                            row.rulesCount
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setRenaming(row.rid)}
                                                className="cursor-pointer text-slate-700 underline underline-offset-2 hover:text-slate-900"
                                            >
                                                Rename
                                            </button>
                                            <button
                                                type="button"
                                                disabled={row.productsCount > 0 || row.rulesCount > 0}
                                                title={row.productsCount > 0 || row.rulesCount > 0 ? 'Move its products and rules to another class first' : undefined}
                                                onClick={() => {
                                                    if (confirm(`Delete the shipping class "${row.name}"?`)) {
                                                        router.delete(route('admin.shipping-classes.destroy', row.rid), { preserveScroll: true });
                                                    }
                                                }}
                                                className="cursor-pointer text-red-600 underline underline-offset-2 hover:text-red-800 disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ),
                        )}
                    </tbody>
                </table>
            </div>
        </AdminLayout>
    );
}

function RenameRow({ row, onDone }: { row: ShippingClassRow; onDone: () => void }) {
    const route = useRoute();
    const { data, setData, put, processing, errors } = useForm({ name: row.name });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        put(route('admin.shipping-classes.update', row.rid), { preserveScroll: true, onSuccess: onDone });
    };

    return (
        <tr className="border-b border-slate-100">
            <td className="px-4 py-3" colSpan={4}>
                <form onSubmit={submit} className="flex flex-wrap items-start gap-2">
                    <div>
                        <label htmlFor={`rename-${row.rid}`} className="sr-only">
                            New name for {row.name}
                        </label>
                        <input
                            id={`rename-${row.rid}`}
                            type="text"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            onKeyDown={(e) => e.key === 'Escape' && onDone()}
                            aria-invalid={Boolean(errors.name)}
                            className={inputClass(errors.name, 'w-64')}
                            maxLength={80}
                            autoFocus
                        />
                        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                    </div>
                    <button
                        type="submit"
                        disabled={processing}
                        className="cursor-pointer rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Save name
                    </button>
                    <button type="button" onClick={onDone} className="cursor-pointer rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                        Cancel
                    </button>
                </form>
            </td>
        </tr>
    );
}
