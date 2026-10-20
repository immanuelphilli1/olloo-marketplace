import { Link, router } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import Pagination from '@/Components/Pagination';
import { useRoute } from '@/utils/route';

type CustomerRow = {
    rid: string;
    name: string;
    email: string;
    isGuest: boolean;
    ordersCount: number;
    createdAt: string | null;
};

type Props = {
    customers: {
        data: CustomerRow[];
        links: Array<{ url: string | null; label: string; active: boolean }>;
    };
    filters: { search: string };
};

export default function Index({ customers, filters }: Props) {
    const route = useRoute();

    return (
        <AdminLayout title="Customers">
            <form
                className="mb-4 flex gap-2"
                onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    router.get(
                        route('admin.customers.index'),
                        { search: String(data.get('search') || '') || undefined },
                        { preserveState: true, replace: true },
                    );
                }}
            >
                <input
                    name="search"
                    defaultValue={filters.search}
                    placeholder="Search name, email, rid"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
                <button type="submit" className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm">
                    Search
                </button>
            </form>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                            <th className="px-4 py-3 font-medium">Name</th>
                            <th className="px-4 py-3 font-medium">Email</th>
                            <th className="px-4 py-3 font-medium">Orders</th>
                            <th className="px-4 py-3 font-medium">Type</th>
                        </tr>
                    </thead>
                    <tbody>
                        {customers.data.map((customer) => (
                            <tr key={customer.rid} className="border-b border-slate-100">
                                <td className="px-4 py-3">
                                    <Link
                                        href={route('admin.customers.show', customer.rid)}
                                        className="cursor-pointer font-medium underline"
                                    >
                                        {customer.name}
                                    </Link>
                                </td>
                                <td className="px-4 py-3">{customer.email}</td>
                                <td className="px-4 py-3">{customer.ordersCount}</td>
                                <td className="px-4 py-3">{customer.isGuest ? 'guest' : 'registered'}</td>
                            </tr>
                        ))}
                        {customers.data.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                                    No customers found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <Pagination links={customers.links} />
        </AdminLayout>
    );
}
