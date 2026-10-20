import { Link, router } from '@inertiajs/react';
import { useState, type ReactNode } from 'react';
import { FaChevronDown, FaChevronRight, FaPen, FaPlus, FaTrash } from 'react-icons/fa';
import { Badge } from '@/Components/Form';
import { useRoute } from '@/utils/route';

export type CategoryTreeNode = {
    rid: string;
    label: string;
    slug: string;
    imageUrl: string | null;
    isActive: boolean;
    childrenCount: number;
    productsCount: number;
    children: CategoryTreeNode[];
};

type Props = {
    nodes: CategoryTreeNode[];
    /** The details page the tree sits on; deletes return there. Omit on the index. */
    rootRid?: string;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canViewProducts?: boolean;
    /** Expand every row, e.g. while a search filter is narrowing the tree. */
    expandAll?: boolean;
    empty?: ReactNode;
};

/** Keep nodes whose label or slug matches, plus the ancestors that lead to them. */
export function filterTree(nodes: CategoryTreeNode[], query: string): CategoryTreeNode[] {
    const q = query.trim().toLowerCase();
    if (q === '') return nodes;

    return nodes.flatMap((node) => {
        const children = filterTree(node.children, q);
        const matches = node.label.toLowerCase().includes(q) || node.slug.toLowerCase().includes(q);
        return matches || children.length > 0 ? [{ ...node, children: matches ? node.children : children }] : [];
    });
}

export default function CategoryTree({ nodes, empty, ...rest }: Props) {
    if (nodes.length === 0) {
        return <div className="px-4 py-6 text-center text-sm text-slate-500">{empty ?? 'No child categories yet.'}</div>;
    }

    return (
        <ul className="divide-y divide-slate-100">
            {nodes.map((node) => (
                <TreeRow key={node.rid} node={node} depth={0} {...rest} />
            ))}
        </ul>
    );
}

function TreeRow({
    node,
    depth,
    rootRid,
    canCreate,
    canEdit,
    canDelete,
    canViewProducts = false,
    expandAll = false,
}: Omit<Props, 'nodes' | 'empty'> & { node: CategoryTreeNode; depth: number }) {
    const route = useRoute();
    const [expanded, setExpanded] = useState(depth < 1);
    const hasChildren = node.children.length > 0;
    const open = expandAll || expanded;

    const removeBlockedReason =
        node.childrenCount > 0
            ? 'Move or remove its child categories first'
            : node.productsCount > 0
              ? 'Move its products to another category first'
              : null;

    const remove = () => {
        if (removeBlockedReason) return;
        if (confirm(`Delete "${node.label}"? This cannot be undone.`)) {
            router.delete(
                route('admin.categories.destroy', rootRid ? { category: node.rid, from: rootRid } : { category: node.rid }),
                { preserveScroll: true },
            );
        }
    };

    const productsLabel = `${node.productsCount} ${node.productsCount === 1 ? 'product' : 'products'}`;

    return (
        <li>
            <div className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50" style={{ paddingLeft: 12 + depth * 24 }}>
                {hasChildren ? (
                    <button
                        type="button"
                        onClick={() => setExpanded(!open)}
                        disabled={expandAll}
                        className="cursor-pointer rounded p-1 text-slate-500 hover:bg-slate-200 disabled:cursor-not-allowed"
                        aria-label={open ? `Collapse ${node.label}` : `Expand ${node.label}`}
                        aria-expanded={open}
                    >
                        {open ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                    </button>
                ) : (
                    <span className="w-6" />
                )}
                {node.imageUrl ? (
                    <img src={node.imageUrl} alt="" className="h-8 w-8 rounded object-cover" />
                ) : (
                    <span className="h-8 w-8 rounded bg-slate-100" />
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <Link
                            href={route('admin.categories.show', node.rid)}
                            className="cursor-pointer truncate text-sm font-medium text-slate-900 hover:underline"
                        >
                            {node.label}
                        </Link>
                        {!node.isActive && <Badge tone="amber">Hidden</Badge>}
                    </div>
                    <p className="truncate text-xs text-slate-500">
                        <span className="font-mono">{node.slug}</span>
                        {node.childrenCount > 0 && ` · ${node.childrenCount} ${node.childrenCount === 1 ? 'child' : 'children'}`}
                        {' · '}
                        {canViewProducts && node.productsCount > 0 ? (
                            <Link
                                href={route('admin.products.index', { category: node.rid })}
                                className="cursor-pointer underline underline-offset-2 hover:text-slate-800"
                            >
                                {productsLabel}
                            </Link>
                        ) : (
                            productsLabel
                        )}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    {canCreate && (
                        <Link
                            href={route('admin.categories.create', { parent: node.rid })}
                            title={`Add a category under ${node.label}`}
                            aria-label={`Add a category under ${node.label}`}
                            className="cursor-pointer rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                        >
                            <FaPlus size={12} />
                        </Link>
                    )}
                    {canEdit && (
                        <Link
                            href={route('admin.categories.edit', node.rid)}
                            title={`Edit ${node.label}`}
                            aria-label={`Edit ${node.label}`}
                            className="cursor-pointer rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                        >
                            <FaPen size={12} />
                        </Link>
                    )}
                    {canDelete &&
                        (removeBlockedReason ? (
                            <span
                                title={`Cannot delete: ${removeBlockedReason.toLowerCase()}`}
                                aria-label={`Cannot delete ${node.label}: ${removeBlockedReason.toLowerCase()}`}
                                className="cursor-not-allowed rounded p-1.5 text-slate-300"
                            >
                                <FaTrash size={12} />
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={remove}
                                title={`Delete ${node.label}`}
                                aria-label={`Delete ${node.label}`}
                                className="cursor-pointer rounded p-1.5 text-slate-500 hover:bg-red-100 hover:text-red-700"
                            >
                                <FaTrash size={12} />
                            </button>
                        ))}
                </div>
            </div>
            {hasChildren && open && (
                <ul>
                    {node.children.map((child) => (
                        <TreeRow
                            key={child.rid}
                            node={child}
                            depth={depth + 1}
                            rootRid={rootRid}
                            canCreate={canCreate}
                            canEdit={canEdit}
                            canDelete={canDelete}
                            canViewProducts={canViewProducts}
                            expandAll={expandAll}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
}
