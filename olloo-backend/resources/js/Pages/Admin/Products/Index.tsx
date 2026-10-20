import { Link, router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { FaSearch } from 'react-icons/fa';
import AdminLayout from '../Layouts/AdminLayout';
import Pagination from '@/Components/Pagination';
import CategoryTreePicker, { CategoryPickerNode } from '@/Components/CategoryTreePicker';
import { Badge } from '@/Components/Form';
import { useRoute } from '@/utils/route';

type ProductRow = {
    rid: string;
    name: string;
    slug: string;
    categoryPath: string | null;
    tags: string[];
    shippingClassName: string | null;
    handlingDays: number | null;
    currencyCode: string;
    price: number;
    originalPrice: number | null;
    imageUrl: string | null;
    isActive: boolean;
    isFeatured: boolean;
    isNewArrival: boolean;
};

type Paginated<T> = {
    data: T[];
    total: number;
    links: Array<{ url: string | null; label: string; active: boolean }>;
};

type Filters = { q: string; status: string; category: string; tag: string };

type Props = {
    products: Paginated<ProductRow>;
    filters: Filters;
    categoryTree: CategoryPickerNode[];
    tags: Array<{ rid: string; name: string }>;
    /** Storefront base URL (WEB_CLIENT_URL), or null when it is not configured. */
    storefrontUrl: string | null;
};

type SharedProps = {
    auth: { staff: { permissions: string[] } | null };
};

const STATUS_OPTIONS = [
    { value: '', label: 'Any status' },
    { value: 'active', label: 'Visible' },
    { value: 'inactive', label: 'Hidden' },
    { value: 'featured', label: 'Featured' },
    { value: 'new_arrival', label: 'New arrival' },
];

export default function Index({ products, filters, categoryTree, tags, storefrontUrl }: Props) {
    const route = useRoute();
    const permissions = usePage<SharedProps>().props.auth.staff?.permissions ?? [];
    const [search, setSearch] = useState(filters.q);
    // Skips the debounced search on mount and when "Clear filters" resets the box.
    const skipSearch = useRef(true);

    const applyFilters = (next: Partial<Filters>) => {
        const merged = { ...filters, q: search, ...next };
        router.get(
            route('admin.products.index'),
            Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== '')),
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    // Search as the user types, without a request per keystroke.
    useEffect(() => {
        if (skipSearch.current) {
            skipSearch.current = false;
            return;
        }
        if (search === filters.q) return;
        const timer = window.setTimeout(() => applyFilters({ q: search }), 300);
        return () => window.clearTimeout(timer);
    }, [search]);

    const filtering = Boolean(filters.q || filters.status || filters.category || filters.tag);
    const clearFilters = () => {
        skipSearch.current = search !== '';
        setSearch('');
        router.get(route('admin.products.index'), {}, { preserveState: true, replace: true });
    };

    const destroy = (product: ProductRow) => {
        if (confirm(`Delete "${product.name}"? This cannot be undone.`)) {
            router.delete(route('admin.products.destroy', product.rid), { preserveScroll: true });
        }
    };

    return (
        <AdminLayout title="Products">
            <div className="mb-4 flex flex-wrap items-end gap-3">
                <label className="relative min-w-56 flex-1 text-sm">
                    <span className="sr-only">Search products</span>
                    <FaSearch className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name or slug"
                        className="w-full rounded-md border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                </label>
                <div className="w-64 text-sm">
                    <CategoryTreePicker
                        nodes={categoryTree}
                        value={filters.category}
                        onChange={(rid) => applyFilters({ category: rid })}
                        placeholder="All categories"
                        allowClear
                        clearLabel="Show all categories"
                    />
                </div>
                <select
                    aria-label="Filter by tag"
                    value={filters.tag}
                    onChange={(e) => applyFilters({ tag: e.target.value })}
                    className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                    <option value="">Any tag</option>
                    {tags.map((tag) => (
                        <option key={tag.rid} value={tag.rid}>
                            {tag.name}
                        </option>
                    ))}
                </select>
                <select
                    aria-label="Filter by status"
                    value={filters.status}
                    onChange={(e) => applyFilters({ status: e.target.value })}
                    className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                    {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                {permissions.includes('create_products') && (
                    <Link
                        href={route('admin.products.create', filters.category ? { category: filters.category } : undefined)}
                        className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    >
                        New product
                    </Link>
                )}
                <div className="ml-auto flex gap-2">
                    {/* A plain link, not Inertia: the response is a file download. */}
                    <a
                        href={route(
                            'admin.products.export',
                            Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '')),
                        )}
                        title="Download the products in this list as a spreadsheet. It uses the same columns as Add from spreadsheet, so you can edit it and bring it back (up to 2,000 rows per file)."
                        className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        Export CSV
                    </a>
                    {permissions.includes('create_products') && (
                        <>
                            <Link
                                href={route('admin.products.import.csv')}
                                className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                                Add from spreadsheet
                            </Link>
                            {permissions.includes('edit_products') && (
                                <Link
                                    href={route('admin.products.import.images')}
                                    className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                >
                                    Add photos
                                </Link>
                            )}
                            <Link
                                href={route('admin.products.import.index')}
                                className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                                Import history
                            </Link>
                        </>
                    )}
                </div>
            </div>

            <div className="mb-2 flex items-center gap-3 text-sm text-slate-600">
                <span>
                    {products.total} {products.total === 1 ? 'product' : 'products'}
                    {filtering && ' match'}
                </span>
                {filtering && (
                    <button type="button" onClick={clearFilters} className="cursor-pointer underline underline-offset-2 hover:text-slate-900">
                        Clear filters
                    </button>
                )}
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                            <th className="px-4 py-3 font-medium">Product</th>
                            <th className="px-4 py-3 font-medium">Category</th>
                            <th className="px-4 py-3 font-medium">Price</th>
                            <th className="px-4 py-3 font-medium">Shipping</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.data.map((product) => (
                            <tr key={product.rid} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        {product.imageUrl ? (
                                            <img src={product.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                                        ) : (
                                            <span className="h-10 w-10 shrink-0 rounded bg-slate-100" />
                                        )}
                                        <div className="min-w-0">
                                            {permissions.includes('edit_products') ? (
                                                <Link
                                                    href={route('admin.products.edit', product.rid)}
                                                    className="cursor-pointer font-medium text-slate-900 hover:underline"
                                                >
                                                    {product.name}
                                                </Link>
                                            ) : (
                                                <span className="font-medium text-slate-900">{product.name}</span>
                                            )}
                                            <div className="font-mono text-xs text-slate-500">{product.slug}</div>
                                            {product.tags.length > 0 && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {product.tags.map((tag) => (
                                                        <Badge key={tag}>{tag}</Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="max-w-56 px-4 py-3 text-slate-700">
                                    <span className="block truncate" title={product.categoryPath ?? undefined}>
                                        {product.categoryPath ?? <span className="text-red-600">No category</span>}
                                    </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="font-medium text-slate-900">
                                        {product.currencyCode} {product.price.toFixed(2)}
                                    </div>
                                    {product.originalPrice !== null && (
                                        <div className="text-xs text-slate-400 line-through">
                                            {product.currencyCode} {product.originalPrice.toFixed(2)}
                                        </div>
                                    )}
                                </td>
                                <td className="max-w-48 px-4 py-3 text-slate-700">
                                    <span className="block truncate">{product.shippingClassName ?? 'Standard'}</span>
                                    {product.handlingDays !== null && (
                                        <span className="block text-xs text-slate-500">
                                            Ships in {product.handlingDays} {product.handlingDays === 1 ? 'day' : 'days'}
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-1">
                                        {product.isActive ? <Badge tone="green">Visible</Badge> : <Badge tone="amber">Hidden</Badge>}
                                        {product.isFeatured && <Badge tone="sky">Featured</Badge>}
                                        {product.isNewArrival && <Badge tone="violet">New</Badge>}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex justify-end gap-3">
                                        {/* Visible products only: a hidden product's public page is a 404. */}
                                        {storefrontUrl && product.isActive && (
                                            <a
                                                href={`${storefrontUrl}/products/${product.rid}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="cursor-pointer whitespace-nowrap text-slate-700 underline underline-offset-2 hover:text-slate-900"
                                            >
                                                View in shop
                                            </a>
                                        )}
                                        {permissions.includes('edit_products') && (
                                            <Link
                                                href={route('admin.products.edit', product.rid)}
                                                className="cursor-pointer text-slate-700 underline underline-offset-2 hover:text-slate-900"
                                            >
                                                Edit
                                            </Link>
                                        )}
                                        {permissions.includes('delete_products') && (
                                            <button
                                                type="button"
                                                className="cursor-pointer text-red-600 underline underline-offset-2 hover:text-red-800"
                                                onClick={() => destroy(product)}
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {products.data.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                                    {filtering ? (
                                        <>
                                            No products match these filters.{' '}
                                            <button
                                                type="button"
                                                onClick={clearFilters}
                                                className="cursor-pointer underline underline-offset-2 hover:text-slate-900"
                                            >
                                                Clear filters
                                            </button>
                                        </>
                                    ) : permissions.includes('create_products') ? (
                                        <>
                                            No products yet.{' '}
                                            <Link
                                                href={route('admin.products.create')}
                                                className="cursor-pointer underline underline-offset-2 hover:text-slate-900"
                                            >
                                                Add your first product
                                            </Link>
                                        </>
                                    ) : (
                                        'No products yet.'
                                    )}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination links={products.links} />
        </AdminLayout>
    );
}
