import { Link, router } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import CategoryTree, { CategoryTreeNode } from '@/Components/CategoryTree';
import { Badge } from '@/Components/Form';
import { useRoute } from '@/utils/route';
import { FaArrowLeft, FaBox, FaPen, FaPlus, FaTrash } from 'react-icons/fa';

type Props = {
    category: {
        rid: string;
        label: string;
        slug: string;
        imageUrl: string | null;
        path: string;
        parentRid: string | null;
        isActive: boolean;
        isReturnable: boolean;
        returnWindowDays: number | null;
        productsCount: number;
        subtreeProductsCount: number;
        children: CategoryTreeNode[];
        attributes: Array<{
            rid: string;
            label: string;
            key: string;
            options: string[];
            inheritedFrom: { rid: string; label: string } | null;
        }>;
    };
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canCreateProducts: boolean;
    canViewProducts: boolean;
};

function countDescendants(nodes: CategoryTreeNode[]): number {
    return nodes.reduce((total, node) => total + 1 + countDescendants(node.children), 0);
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export default function Show({ category, canCreate, canEdit, canDelete, canCreateProducts, canViewProducts }: Props) {
    const route = useRoute();
    const totalDescendants = countDescendants(category.children);
    const deleteBlockedReason =
        category.children.length > 0
            ? 'Move or delete its child categories first.'
            : category.productsCount > 0
              ? 'Move its products to another category first.'
              : null;

    const remove = () => {
        if (confirm(`Delete "${category.label}"? This cannot be undone.`)) {
            router.delete(route('admin.categories.destroy', category.rid));
        }
    };

    const secondaryButton =
        'flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50';

    return (
        <AdminLayout title={category.label}>
            <div className="mb-4">
                <Link
                    href={category.parentRid ? route('admin.categories.show', category.parentRid) : route('admin.categories.index')}
                    className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
                >
                    <FaArrowLeft size={11} />
                    {category.parentRid ? 'Back to parent category' : 'All categories'}
                </Link>
            </div>

            <div className="mb-6 flex flex-wrap items-start gap-4 rounded-lg border border-slate-200 bg-white p-5">
                {category.imageUrl ? (
                    <img src={category.imageUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
                ) : (
                    <span className="h-20 w-20 rounded-lg bg-slate-100" />
                )}
                <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-500">{category.path}</p>
                    <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
                        {category.label}
                        {category.isActive ? <Badge tone="green">Visible</Badge> : <Badge tone="amber">Hidden</Badge>}
                        {category.isReturnable ? (
                            <Badge tone="sky">
                                {category.returnWindowDays ? `Returnable within ${category.returnWindowDays} days` : 'Returnable'}
                            </Badge>
                        ) : (
                            <Badge tone="amber">Non-returnable</Badge>
                        )}
                    </h2>
                    <p className="font-mono text-xs text-slate-500">{category.slug}</p>
                    <p className="mt-1 text-sm text-slate-600">
                        {plural(category.children.length, 'direct child', 'direct children')} ·{' '}
                        {plural(totalDescendants, 'category', 'categories')} below ·{' '}
                        {plural(category.productsCount, 'product', 'products')} here
                        {category.subtreeProductsCount !== category.productsCount &&
                            `, ${category.subtreeProductsCount} including subcategories`}
                    </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                    {canViewProducts && category.subtreeProductsCount > 0 && (
                        <Link href={route('admin.products.index', { category: category.rid })} className={secondaryButton}>
                            <FaBox size={12} /> View products
                        </Link>
                    )}
                    {canCreateProducts && (
                        <Link href={route('admin.products.create', { category: category.rid })} className={secondaryButton}>
                            <FaPlus size={12} /> Add product
                        </Link>
                    )}
                    {canEdit && (
                        <Link href={route('admin.categories.edit', category.rid)} className={secondaryButton}>
                            <FaPen size={12} /> Edit
                        </Link>
                    )}
                    {canCreate && (
                        <Link
                            href={route('admin.categories.create', { parent: category.rid })}
                            className="flex cursor-pointer items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                        >
                            <FaPlus size={12} /> Add subcategory
                        </Link>
                    )}
                    {canDelete && (
                        <button
                            type="button"
                            onClick={remove}
                            disabled={deleteBlockedReason !== null}
                            title={deleteBlockedReason ? `Cannot delete: ${deleteBlockedReason}` : undefined}
                            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white"
                        >
                            <FaTrash size={12} /> Delete
                        </button>
                    )}
                </div>
            </div>

            <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 text-sm">
                <div className="mb-2 flex items-center justify-between gap-3">
                    <h2 className="font-semibold text-slate-900">Product attributes</h2>
                    {canEdit && (
                        <Link href={route('admin.categories.edit', category.rid)} className="cursor-pointer text-slate-600 underline underline-offset-2 hover:text-slate-900">
                            Manage
                        </Link>
                    )}
                </div>
                {category.attributes.length === 0 ? (
                    <p className="text-slate-500">
                        None yet. Add attributes such as brand or color so products here can be filtered by them.
                    </p>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {category.attributes.map((attribute) => (
                            <li key={attribute.rid} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                                <span>
                                    <span className="font-medium text-slate-900">{attribute.label}</span>
                                    <span className="ml-2 font-mono text-xs text-slate-400">{attribute.key}</span>
                                </span>
                                <span className="text-slate-500">
                                    {attribute.options.length > 0 ? attribute.options.join(', ') : 'Any value'}
                                    {attribute.inheritedFrom && (
                                        <>
                                            {' · from '}
                                            <Link
                                                href={route('admin.categories.show', attribute.inheritedFrom.rid)}
                                                className="cursor-pointer underline underline-offset-2 hover:text-slate-900"
                                            >
                                                {attribute.inheritedFrom.label}
                                            </Link>
                                        </>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <h2 className="mb-2 text-sm font-semibold text-slate-700">Subcategories</h2>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <CategoryTree
                    nodes={category.children}
                    rootRid={category.rid}
                    canCreate={canCreate}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    canViewProducts={canViewProducts}
                    empty={
                        canCreate ? (
                            <>
                                No subcategories yet.{' '}
                                <Link
                                    href={route('admin.categories.create', { parent: category.rid })}
                                    className="cursor-pointer underline underline-offset-2 hover:text-slate-900"
                                >
                                    Add one
                                </Link>
                            </>
                        ) : (
                            'No subcategories yet.'
                        )
                    }
                />
            </div>
        </AdminLayout>
    );
}
