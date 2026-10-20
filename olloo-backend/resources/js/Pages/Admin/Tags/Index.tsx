import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import { FaSearch } from 'react-icons/fa';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import Pagination from '@/Components/Pagination';
import { inputClass } from '@/Components/Form';
import { useRoute } from '@/utils/route';

type TagRow = {
    rid: string;
    name: string;
    slug: string;
    productsCount: number;
};

type Paginated<T> = {
    data: T[];
    links: Array<{ url: string | null; label: string; active: boolean }>;
};

type Props = {
    tags: Paginated<TagRow>;
    filters: { q: string };
    total: number;
    unused: number;
    mergeTargets: Array<{ rid: string; name: string }>;
    canEdit: boolean;
    canDelete: boolean;
};

type SharedProps = {
    auth: { staff: { permissions: string[] } | null };
};

type Mode = { rid: string; action: 'rename' | 'merge' } | null;

export default function Index({ tags, filters, total, unused, mergeTargets, canEdit, canDelete }: Props) {
    const route = useRoute();
    const canViewProducts = usePage<SharedProps>().props.auth.staff?.permissions.includes('view_products') ?? false;
    const [query, setQuery] = useState(filters.q);
    const [mode, setMode] = useState<Mode>(null);
    // Skips the debounced search on mount and when "Clear search" resets it.
    const skipSearch = useRef(true);

    const visible = tags.data;

    useEffect(() => setQuery(filters.q), [filters.q]);

    // Search as they type, without a request per keystroke.
    useEffect(() => {
        if (skipSearch.current) {
            skipSearch.current = false;
            return;
        }
        if (query === filters.q) return;

        const timer = window.setTimeout(() => {
            router.get(
                route('admin.tags.index'),
                query.trim() === '' ? {} : { q: query },
                { preserveState: true, preserveScroll: true, replace: true },
            );
        }, 300);

        return () => window.clearTimeout(timer);
    }, [query, filters.q]);

    return (
        <AdminLayout title="Tags">
            <p className="mb-4 max-w-2xl text-sm text-slate-600">
                Tags group products across categories. Add new tags while editing a product. Here you can tidy them up: fix
                a name, merge duplicates such as "Best seller" and "Bestseller", or delete tags nobody uses.
            </p>

            <div className="mb-4 flex flex-wrap items-center gap-3">
                <label className="relative min-w-56 flex-1 text-sm sm:max-w-sm">
                    <span className="sr-only">Search tags</span>
                    <FaSearch className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search tags"
                        className="w-full rounded-md border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                </label>
                <span className="text-sm text-slate-600">
                    {query.trim() === ''
                        ? `${total} ${total === 1 ? 'tag' : 'tags'}`
                        : `${visible.length} of ${total} ${total === 1 ? 'tag' : 'tags'}`}
                    {unused > 0 && `, ${unused} unused`}
                </span>
                {query.trim() !== '' && (
                    <button
                        type="button"
                        onClick={() => {
                            skipSearch.current = true;
                            setQuery('');
                            router.get(route('admin.tags.index'), {}, { preserveState: true, replace: true });
                        }}
                        className="cursor-pointer text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900"
                    >
                        Clear search
                    </button>
                )}
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                            <th className="px-4 py-3 font-medium">Tag</th>
                            <th className="px-4 py-3 font-medium">Products</th>
                            <th className="px-4 py-3 font-medium">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((tag) => (
                            <TagTableRow
                                key={tag.rid}
                                tag={tag}
                                mergeTargets={mergeTargets}
                                mode={mode?.rid === tag.rid ? mode.action : null}
                                setMode={(action) => setMode(action ? { rid: tag.rid, action } : null)}
                                canEdit={canEdit}
                                canDelete={canDelete}
                                canViewProducts={canViewProducts}
                            />
                        ))}
                        {visible.length === 0 && (
                            <tr>
                                <td colSpan={3} className="px-4 py-10 text-center text-slate-500">
                                    {query.trim() !== '' ? (
                                        <>
                                            No tags match "{query.trim()}".{' '}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    skipSearch.current = true;
                                                    setQuery('');
                                                    router.get(
                                                        route('admin.tags.index'),
                                                        {},
                                                        { preserveState: true, replace: true },
                                                    );
                                                }}
                                                className="cursor-pointer underline underline-offset-2 hover:text-slate-900"
                                            >
                                                Clear search
                                            </button>
                                        </>
                                    ) : (
                                        'No tags yet. Add tags while creating or editing a product.'
                                    )}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination links={tags.links} />
        </AdminLayout>
    );
}

function TagTableRow({
    tag,
    mergeTargets,
    mode,
    setMode,
    canEdit,
    canDelete,
    canViewProducts,
}: {
    tag: TagRow;
    mergeTargets: Array<{ rid: string; name: string }>;
    mode: 'rename' | 'merge' | null;
    setMode: (action: 'rename' | 'merge' | null) => void;
    canEdit: boolean;
    canDelete: boolean;
    canViewProducts: boolean;
}) {
    const route = useRoute();
    const productsLabel = `${tag.productsCount} ${tag.productsCount === 1 ? 'product' : 'products'}`;

    const destroy = () => {
        const impact = tag.productsCount > 0 ? ` It will be removed from ${productsLabel}.` : '';
        if (confirm(`Delete the tag "${tag.name}"?${impact} This cannot be undone.`)) {
            router.delete(route('admin.tags.destroy', tag.rid), { preserveScroll: true });
        }
    };

    const linkButton = 'cursor-pointer text-slate-700 underline underline-offset-2 hover:text-slate-900';

    return (
        <tr className="border-b border-slate-100 align-top last:border-0">
            <td className="px-4 py-3">
                {mode === 'rename' ? (
                    <RenameForm tag={tag} onDone={() => setMode(null)} />
                ) : mode === 'merge' ? (
                    <MergeForm tag={tag} mergeTargets={mergeTargets} onDone={() => setMode(null)} />
                ) : (
                    <>
                        <div className="font-medium text-slate-900">{tag.name}</div>
                        <div className="font-mono text-xs text-slate-500">{tag.slug}</div>
                    </>
                )}
            </td>
            <td className="px-4 py-3 whitespace-nowrap">
                {canViewProducts && tag.productsCount > 0 ? (
                    <Link href={route('admin.products.index', { tag: tag.rid })} className={linkButton}>
                        {productsLabel}
                    </Link>
                ) : (
                    <span className={tag.productsCount === 0 ? 'text-slate-400' : 'text-slate-700'}>
                        {tag.productsCount === 0 ? 'Unused' : productsLabel}
                    </span>
                )}
            </td>
            <td className="px-4 py-3">
                {mode === null && (
                    <div className="flex justify-end gap-3">
                        {canEdit && (
                            <>
                                <button type="button" onClick={() => setMode('rename')} className={linkButton}>
                                    Rename
                                </button>
                                {mergeTargets.length > 1 && (
                                    <button type="button" onClick={() => setMode('merge')} className={linkButton}>
                                        Merge
                                    </button>
                                )}
                            </>
                        )}
                        {canDelete && (
                            <button
                                type="button"
                                onClick={destroy}
                                className="cursor-pointer text-red-600 underline underline-offset-2 hover:text-red-800"
                            >
                                Delete
                            </button>
                        )}
                    </div>
                )}
            </td>
        </tr>
    );
}

function RenameForm({ tag, onDone }: { tag: TagRow; onDone: () => void }) {
    const route = useRoute();
    const { data, setData, put, processing, errors } = useForm({ name: tag.name });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        put(route('admin.tags.update', tag.rid), { preserveScroll: true, onSuccess: onDone });
    };

    return (
        <form onSubmit={submit} className="space-y-1">
            <label htmlFor={`rename-${tag.rid}`} className="block text-xs font-medium text-slate-600">
                New name for "{tag.name}"
            </label>
            <div className="flex flex-wrap items-center gap-2">
                <input
                    id={`rename-${tag.rid}`}
                    type="text"
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && onDone()}
                    aria-invalid={Boolean(errors.name)}
                    className={inputClass(errors.name, 'w-56')}
                    maxLength={60}
                    autoFocus
                />
                <FormButtons processing={processing} submitLabel="Save name" onCancel={onDone} />
            </div>
            {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
            {tag.productsCount > 0 && !errors.name && (
                <p className="text-xs text-slate-500">Updates the tag on all {tag.productsCount} products.</p>
            )}
        </form>
    );
}

function MergeForm({
    tag,
    mergeTargets,
    onDone,
}: {
    tag: TagRow;
    mergeTargets: Array<{ rid: string; name: string }>;
    onDone: () => void;
}) {
    const route = useRoute();
    const { data, setData, post, processing, errors } = useForm({ target_rid: '' });
    const targets = mergeTargets.filter((other) => other.rid !== tag.rid);
    const target = targets.find((other) => other.rid === data.target_rid);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!target) return;
        if (confirm(`Move every product tagged "${tag.name}" to "${target.name}" and delete "${tag.name}"?`)) {
            post(route('admin.tags.merge', tag.rid), { preserveScroll: true, onSuccess: onDone });
        }
    };

    return (
        <form onSubmit={submit} className="space-y-1">
            <label htmlFor={`merge-${tag.rid}`} className="block text-xs font-medium text-slate-600">
                Merge "{tag.name}" into
            </label>
            <div className="flex flex-wrap items-center gap-2">
                <select
                    id={`merge-${tag.rid}`}
                    value={data.target_rid}
                    onChange={(e) => setData('target_rid', e.target.value)}
                    aria-invalid={Boolean(errors.target_rid)}
                    className={inputClass(errors.target_rid, 'w-56 cursor-pointer')}
                    autoFocus
                >
                    <option value="" disabled>
                        Pick a tag
                    </option>
                    {targets.map((other) => (
                        <option key={other.rid} value={other.rid}>
                            {other.name}
                        </option>
                    ))}
                </select>
                <FormButtons processing={processing} submitLabel="Merge" onCancel={onDone} disabled={!target} />
            </div>
            {errors.target_rid ? (
                <p className="text-sm text-red-600">{errors.target_rid}</p>
            ) : (
                <p className="text-xs text-slate-500">
                    Its products get the chosen tag instead, then "{tag.name}" is deleted.
                </p>
            )}
        </form>
    );
}

function FormButtons({
    processing,
    submitLabel,
    onCancel,
    disabled = false,
}: {
    processing: boolean;
    submitLabel: string;
    onCancel: () => void;
    disabled?: boolean;
}) {
    return (
        <>
            <button
                type="submit"
                disabled={processing || disabled}
                className="cursor-pointer rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {processing ? 'Saving…' : submitLabel}
            </button>
            <button
                type="button"
                onClick={onCancel}
                className="cursor-pointer rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
                Cancel
            </button>
        </>
    );
}
