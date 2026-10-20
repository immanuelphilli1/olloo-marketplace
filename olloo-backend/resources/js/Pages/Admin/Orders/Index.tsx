import { Link, router } from '@inertiajs/react';
import AdminLayout from '../Layouts/AdminLayout';
import Pagination from '@/Components/Pagination';
import { useRoute } from '@/utils/route';
import { ORDER_STATUS_LABELS } from '@/Components/OrderStatus';
import { OrderPaymentStatusBadge } from '@/Components/PaymentStatus';

type OrderRow = {
    rid: string;
    orderReference: string;
    status: string;
    paymentStatus: string;
    total: number;
    currencyCode: string;
    customerName: string | null;
    customerEmail: string | null;
    placedAt: string | null;
};

type Paginated<T> = {
    data: T[];
    links: Array<{ url: string | null; label: string; active: boolean }>;
};

type Props = {
    orders: Paginated<OrderRow>;
    filters: {
        status: string;
    };
    statuses: string[];
};

export default function Index({ orders, filters, statuses }: Props) {
    const route = useRoute();

    return (
        <AdminLayout title="Orders">
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <label className="text-sm text-slate-700">
                    Status{' '}
                    <select
                        className="cursor-pointer ml-2 rounded-md border border-slate-300 px-3 py-1.5"
                        value={filters.status}
                        onChange={(e) =>
                            router.get(
                                route('admin.orders.index'),
                                { status: e.target.value || undefined },
                                { preserveState: true, replace: true },
                            )
                        }
                    >
                        <option value="">All</option>
                        {statuses.map((status) => (
                            <option key={status} value={status}>
                                {ORDER_STATUS_LABELS[status] ?? status}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                            <th className="px-4 py-3 font-medium">Reference</th>
                            <th className="px-4 py-3 font-medium">Customer</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Payment</th>
                            <th className="px-4 py-3 font-medium">Total</th>
                            <th className="px-4 py-3 font-medium">Placed</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.data.map((order) => (
                            <tr key={order.rid} className="border-b border-slate-100">
                                <td className="px-4 py-3">
                                    <Link
                                        href={route('admin.orders.show', order.rid)}
                                        className="cursor-pointer font-medium underline"
                                    >
                                        {order.orderReference}
                                    </Link>
                                </td>
                                <td className="px-4 py-3">
                                    <div>{order.customerName ?? '-'}</div>
                                    <div className="text-xs text-slate-500">
                                        {order.customerEmail}
                                    </div>
                                </td>
                                <td className="px-4 py-3">{ORDER_STATUS_LABELS[order.status] ?? order.status}</td>
                                <td className="px-4 py-3">
                                    <OrderPaymentStatusBadge status={order.paymentStatus} />
                                </td>
                                <td className="px-4 py-3">
                                    {order.total.toFixed(2)} {order.currencyCode}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {order.placedAt
                                        ? new Date(order.placedAt).toLocaleString()
                                        : '-'}
                                </td>
                            </tr>
                        ))}
                        {orders.data.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="px-4 py-8 text-center text-slate-500"
                                >
                                    No orders found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination links={orders.links} />
        </AdminLayout>
    );
}
