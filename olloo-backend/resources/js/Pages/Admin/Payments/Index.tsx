import { useEffect, useState } from 'react';
import { Link, router } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import Pagination from '@/Components/Pagination';
import CopyButton from '@/Components/CopyButton';
import {
    PaymentStatusBadge,
    formatDateTime,
    formatMoney,
    formatTotals,
    paymentProviderLabel,
    paymentStatusLabel,
} from '@/Components/PaymentStatus';
import { useRoute } from '@/utils/route';

type PaymentRow = {
    rid: string;
    provider: string;
    status: string;
    amount: number;
    currencyCode: string;
    externalReference: string | null;
    createdAt: string | null;
    order: { rid: string; reference: string } | null;
    user: { rid: string; name: string; email: string } | null;
};

type SummaryRow = {
    status: string;
    count: number;
    totals: Array<{ currency: string; amount: number }>;
};

type Props = {
    payments: {
        data: PaymentRow[];
        links: Array<{ url: string | null; label: string; active: boolean }>;
    };
    filters: { status: string; provider: string; search: string; range: string };
    statuses: string[];
    providers: string[];
    ranges: Record<string, string>;
    summary: SummaryRow[];
    canViewOrders: boolean;
};

export default function Index({ payments, filters, statuses, providers, ranges, summary, canViewOrders }: Props) {
    const route = useRoute();
    const [search, setSearch] = useState(filters.search);

    useEffect(() => setSearch(filters.search), [filters.search]);

    const visit = (next: Record<string, string | undefined>) => {
        const params: Record<string, string | undefined> = {
            search: next.search !== undefined ? next.search : filters.search || undefined,
            status: next.status !== undefined ? next.status : filters.status || undefined,
            provider: next.provider !== undefined ? next.provider : filters.provider || undefined,
            range: next.range !== undefined ? next.range : filters.range || undefined,
        };

        Object.keys(params).forEach((key) => params[key] === '' && delete params[key]);

        router.get(route('admin.payments.index'), params, { preserveState: true, replace: true });
    };

    const byStatus = (status: string) => summary.find((row) => row.status === status);
    const rangeEntries = Object.entries(ranges);
    const needsReviewCount = byStatus('needs_review')?.count ?? 0;

    return (
        <AdminLayout title="Payments">
            {needsReviewCount > 0 && (
                <div
                    role="status"
                    className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-300 bg-sky-50 p-4"
                >
                    <p className="text-sm text-sky-900">
                        <strong className="font-semibold">
                            {needsReviewCount} {needsReviewCount === 1 ? 'payment needs' : 'payments need'} your review.
                        </strong>{' '}
                        The payment company confirmed money was taken, but it did not match the order. Open one to see what to do.
                    </p>
                    <button
                        type="button"
                        onClick={() => visit({ status: 'needs_review', search: '' })}
                        className="cursor-pointer rounded-md bg-sky-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800"
                    >
                        Show {needsReviewCount === 1 ? 'it' : 'them'}
                    </button>
                </div>
            )}

            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {statuses.map((status) => {
                    const row = byStatus(status);
                    const isActive = filters.status === status;

                    return (
                        <Link
                            key={status}
                            href={route('admin.payments.index', {
                                status: isActive ? undefined : status,
                                search: filters.search || undefined,
                                provider: filters.provider || undefined,
                                range: filters.range === 'all' ? undefined : filters.range,
                            })}
                            className={`cursor-pointer rounded-lg border bg-white p-4 hover:border-slate-400 ${
                                isActive ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'
                            }`}
                        >
                            <p className="text-sm text-slate-600">{paymentStatusLabel(status)}</p>
                            <p className="mt-1 text-2xl font-semibold text-slate-900">{row?.count ?? 0}</p>
                            <p className="mt-1 text-sm text-slate-500">
                                {row ? formatTotals(row.totals) : 'Nothing yet'}
                            </p>
                        </Link>
                    );
                })}
            </div>

            <form
                className="mb-4 space-y-3 rounded-lg border border-slate-200 bg-white p-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    visit({ search });
                }}
            >
                <div className="flex flex-wrap items-end gap-3">
                    <label className="flex-1 text-sm">
                        <span className="mb-1 block font-medium text-slate-700">Find a payment</span>
                        <input
                            name="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Order number, customer name or email, payment reference"
                            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-200"
                        />
                    </label>
                    <button
                        type="submit"
                        className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    >
                        Search
                    </button>
                    {(filters.search || filters.status || filters.provider || filters.range !== 'all') && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearch('');
                                router.get(route('admin.payments.index'), {}, { preserveState: true, replace: true });
                            }}
                            className="cursor-pointer rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                            Clear all
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-sm">
                    <label className="flex items-center gap-2">
                        <span className="text-slate-600">Paid via</span>
                        <select
                            name="provider"
                            value={filters.provider}
                            onChange={(e) => visit({ provider: e.target.value })}
                            className="cursor-pointer rounded-md border border-slate-300 px-2 py-1 text-sm"
                        >
                            <option value="">Any</option>
                            {providers.map((provider) => (
                                <option key={provider} value={provider}>
                                    {paymentProviderLabel(provider)}
                                </option>
                            ))}
                        </select>
                    </label>

                    <span className="text-slate-300">|</span>

                    <span className="text-slate-600">When</span>
                    {rangeEntries.map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => visit({ range: value })}
                            className={`cursor-pointer rounded-full px-3 py-1 text-sm ${
                                filters.range === value
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </form>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                            <th className="px-4 py-3 font-medium">Payment</th>
                            <th className="px-4 py-3 font-medium">Customer</th>
                            <th className="px-4 py-3 font-medium">Order</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Amount</th>
                            <th className="px-4 py-3 font-medium">Received</th>
                        </tr>
                    </thead>
                    <tbody>
                        {payments.data.map((payment) => (
                            <tr key={payment.rid} className="border-b border-slate-100">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={route('admin.payments.show', payment.rid)}
                                            className="cursor-pointer font-medium underline"
                                        >
                                            {payment.rid}
                                        </Link>
                                        <CopyButton value={payment.rid} label="Copy" />
                                    </div>
                                    <div className="text-xs text-slate-500">{paymentProviderLabel(payment.provider)}</div>
                                </td>
                                <td className="px-4 py-3">
                                    {payment.user ? (
                                        <>
                                            <div>{payment.user.name}</div>
                                            <div className="text-xs text-slate-500">{payment.user.email}</div>
                                        </>
                                    ) : (
                                        <span className="text-slate-500">Guest or deleted account</span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    {payment.order ? (
                                        canViewOrders ? (
                                            <Link
                                                href={route('admin.orders.show', payment.order.rid)}
                                                className="cursor-pointer underline"
                                            >
                                                {payment.order.reference}
                                            </Link>
                                        ) : (
                                            payment.order.reference
                                        )
                                    ) : (
                                        <span className="text-slate-500">No order</span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <PaymentStatusBadge status={payment.status} />
                                </td>
                                <td className="px-4 py-3 font-medium">{formatMoney(payment.amount, payment.currencyCode)}</td>
                                <td className="px-4 py-3 text-slate-600">{formatDateTime(payment.createdAt)}</td>
                            </tr>
                        ))}
                        {payments.data.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                                    {filters.search || filters.status || filters.provider ? (
                                        <>
                                            No payments match these filters.{' '}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSearch('');
                                                    router.get(route('admin.payments.index'), {}, { preserveState: true, replace: true });
                                                }}
                                                className="cursor-pointer underline"
                                            >
                                                Clear them
                                            </button>
                                            .
                                        </>
                                    ) : (
                                        'No payments have been taken yet.'
                                    )}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <Pagination links={payments.links} />
        </AdminLayout>
    );
}