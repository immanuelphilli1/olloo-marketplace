import { Link } from '@inertiajs/react';
import AdminLayout from './Layouts/AdminLayout';
import { useRoute } from '@/utils/route';
import { usePage } from '@inertiajs/react';

type Props = {
    stats: {
        products: number;
        activeProducts: number;
        orders: number;
        processingOrders: number;
        payments: number;
        pendingReviews: number;
        inquiries: number;
    };
};

type SharedProps = {
    auth: {
        staff: {
            permissions: string[];
        } | null;
    };
};

export default function Dashboard({ stats }: Props) {
    const route = useRoute();
    const { auth } = usePage<SharedProps>().props;
    const permissions = auth.staff?.permissions ?? [];
    const can = (permission: string) => permissions.includes(permission);

    return (
        <AdminLayout title="Dashboard">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Products" value={stats.products} />
                <StatCard label="Active products" value={stats.activeProducts} />
                <StatCard label="Orders" value={stats.orders} />
                <StatCard label="Processing orders" value={stats.processingOrders} />
                <StatCard label="Payments" value={stats.payments} />
                <StatCard label="Pending reviews" value={stats.pendingReviews} />
                <StatCard label="Inquiries" value={stats.inquiries} />
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
                {can('view_products') && (
                    <Link
                        href={route('admin.products.index')}
                        className="cursor-pointer rounded-md bg-brand px-4 py-2 text-sm text-white hover:bg-brand-dark"
                    >
                        Manage products
                    </Link>
                )}
                {can('view_orders') && (
                    <Link
                        href={route('admin.orders.index')}
                        className="cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
                    >
                        View orders
                    </Link>
                )}
                {can('view_webhooks') && (
                    <Link
                        href={route('admin.webhooks.index')}
                        className="cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
                    >
                        Webhooks
                    </Link>
                )}
                {can('view_request_logs') && (
                    <Link
                        href={route('admin.request-history.index')}
                        className="cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
                    >
                        Request history
                    </Link>
                )}
                {can('view_staff') && (
                    <Link
                        href={route('admin.staff.index')}
                        className="cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
                    >
                        Staff and permissions
                    </Link>
                )}
            </div>
        </AdminLayout>
    );
}

function StatCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-2 text-3xl font-semibold">{value}</div>
        </div>
    );
}
