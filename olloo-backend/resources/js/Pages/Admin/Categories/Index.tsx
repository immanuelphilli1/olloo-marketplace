import { Link, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { FaSearch } from 'react-icons/fa';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import CategoryTree, { CategoryTreeNode, filterTree } from '@/Components/CategoryTree';
import { useRoute } from '@/utils/route';

type Props = {
    tree: CategoryTreeNode[];
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
};

type SharedProps = {
    auth: { staff: { permissions: string[] } | null };
};

function countNodes(nodes: CategoryTreeNode[]): number {
    return nodes.reduce((total, node) => total + 1 + countNodes(node.children), 0);
}

export default function Index({ tree, canCreate, canEdit, canDelete }: Props) {
    const route = useRoute();
    const canViewProducts = usePage<SharedProps>().props.auth.staff?.permissions.includes('view_products') ?? false;
    const [query, setQuery] = useState('');
    const searching = query.trim() !== '';
    const visible = useMemo(() => filterTree(tree, query), [tree, query]);
    const total = useMemo(() => countNodes(tree), [tree]);

    return (
        <AdminLayout title="Categories">
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <label className="relative min-w-56 flex-1 text-sm sm:max-w-sm">
                    <span className="sr-only">Search categories</span>
                    <FaSearch className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by name or slug"
                        className="w-full rounded-md border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                </label>
                <span className="text-sm text-slate-600">
                    {total} {total === 1 ? 'category' : 'categories'}
                </span>
                <div className="ml-auto flex gap-2">
                    {/* A plain link, not Inertia: the response is a file download. */}
                    <a
                        href={route('admin.categories.export')}
                        title="Download every category as a spreadsheet, in tree order."
                        className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        Export CSV
                    </a>
                    {canCreate && (
                        <Link
                            href={route('admin.categories.create')}
                            className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                        >
                            New top-level category
                        </Link>
                    )}
                </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <CategoryTree
                    nodes={visible}
                    canCreate={canCreate}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    canViewProducts={canViewProducts}
                    expandAll={searching}
                    empty={
                        searching ? (
                            <>
                                No categories match "{query.trim()}".{' '}
                                <button
                                    type="button"
                                    onClick={() => setQuery('')}
                                    className="cursor-pointer underline underline-offset-2 hover:text-slate-900"
                                >
                                    Clear search
                                </button>
                            </>
                        ) : canCreate ? (
                            <>
                                No categories yet.{' '}
                                <Link
                                    href={route('admin.categories.create')}
                                    className="cursor-pointer underline underline-offset-2 hover:text-slate-900"
                                >
                                    Create the first one
                                </Link>
                            </>
                        ) : (
                            'No categories yet.'
                        )
                    }
                />
            </div>
            {canCreate && tree.length > 0 && (
                <p className="mt-3 text-sm text-slate-500">
                    Use the + on a row to add a category under it.
                </p>
            )}
        </AdminLayout>
    );
}
