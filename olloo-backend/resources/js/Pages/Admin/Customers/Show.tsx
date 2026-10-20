import { Link } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import { useRoute } from '@/utils/route';

type Props = {
    customer: {
        rid: string;
        name: string;
        email: string;
        phone: string | null;
        isGuest: boolean;
        createdAt: string | null;
    };
    orders: Array<{
        rid: string;
        status: string;
        currencyCode: string;
        total: number;
        createdAt: string | null;
    }>;
    canViewOrders: boolean;
};

export default function Show({ customer, orders, canViewOrders }: Props) {
    const route = useRoute();

    return (
        <AdminLayout title={customer.name}>
            <div className="mb-4">
                <Link href={route('admin.customers.index')} className="cursor-pointer text-sm underline">
                    Back to customers
                </Link>
            </div>

            <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5 text-sm">
                <div><span className="text-slate-500">Email:</span> {customer.email}</div>
                <div><span className="text-slate-500">Phone:</span> {customer.phone ?? '-'}</div>
                <div><span className="text-slate-500">Type:</span> {customer.isGuest ? 'guest' : 'registered'}</div>
                <div><span className="text-slate-500">Rid:</span> <span className="font-mono text-xs">{customer.rid}</span></div>
            </div>

            <h2 className="mb-3 text-lg font-semibold">Recent orders</h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                            <th className="px-4 py-3 font-medium">Order</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Total</th>
                            <th className="px-4 py-3 font-medium">Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map((order) => (
                            <tr key={order.rid} className="border-b border-slate-100">
                                <td className="px-4 py-3">
                                    {canViewOrders ? (
                                        <Link
                                            href={route('admin.orders.show', order.rid)}
                                            className="cursor-pointer font-mono text-xs underline"
                                        >
                                            {order.rid}
                                        </Link>
                                    ) : (
                                        <span className="font-mono text-xs">{order.rid}</span>
                                    )}
                                </td>
                                <td className="px-4 py-3">{order.status}</td>
                                <td className="px-4 py-3">
                                    {order.total.toFixed(2)} {order.currencyCode}
                                </td>
                                <td className="px-4 py-3">
                                    {order.createdAt ? new Date(order.createdAt).toLocaleString() : '-'}
                                </td>
                            </tr>
                        ))}
                        {orders.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                                    No orders yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </AdminLayout>
    );
}
