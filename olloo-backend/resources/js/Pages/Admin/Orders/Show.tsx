import { FormEvent, type ReactNode } from 'react';
import { Link, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '../Layouts/AdminLayout';
import { useRoute } from '@/utils/route';
import { ORDER_STATUS_LABELS } from '@/Components/OrderStatus';
import {
    OrderPaymentStatusBadge,
    PaymentStatusBadge,
    formatDateTime,
    formatMoney,
    paymentProviderLabel,
} from '@/Components/PaymentStatus';

type AuthShared = {
    auth?: {
        staff?: {
            permissions?: string[];
        } | null;
    };
};

type OrderDetail = {
    rid: string;
    orderReference: string;
    status: string;
    paymentStatus: string;
    paymentMethod: string | null;
    currencyCode: string;
    itemsTotal: number;
    itemsDiscount: number;
    shipping: number;
    tax: number;
    taxLines: Array<{ name: string; ratePercent: number; amount: number }>;
    total: number;
    baseCurrencyCode: string | null;
    baseTotal: number | null;
    fxRates: Array<{
        from: string;
        to: string;
        midRate: number;
        markupPercent: number;
        effectiveRate: number;
        fetchedAt: string | null;
    }>;
    estimatedDelivery: string | null;
    addressSnapshot: Record<string, unknown> | null;
    placedAt: string | null;
    customer: {
        rid: string;
        name: string;
        email: string;
    } | null;
    items: Array<{
        rid: string;
        productRid: string | null;
        productName: string;
        variantName: string | null;
        sku: string | null;
        image: string | null;
        unitPrice: number;
        sourceCurrencyCode: string | null;
        sourceUnitPrice: number | null;
        quantity: number;
    }>;
    payments: Array<{
        rid: string;
        provider: string;
        status: string;
        amount: number;
        currencyCode: string;
        externalReference: string | null;
    }>;
};

type Props = {
    order: OrderDetail;
    statuses: string[];
    canEdit: boolean;
};

type SharedProps = {
    errors: Record<string, string>;
};

export default function Show({ order, statuses, canEdit }: Props) {
    const route = useRoute();
    const { errors, auth } = usePage<SharedProps & AuthShared>().props;
    const canViewRequestLogs = Boolean(auth?.staff?.permissions?.includes('view_request_logs'));
    const { data, setData, put, processing } = useForm({
        status: order.status,
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        put(route('admin.orders.updateStatus', order.rid));
    };

    return (
        <AdminLayout title={order.orderReference}>
            <div className="mb-4">
                <Link
                    href={route('admin.orders.index')}
                    className="cursor-pointer text-sm text-slate-600 underline"
                >
                    Back to orders
                </Link>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-2">
                    <section className="rounded-lg border border-slate-200 bg-white p-5">
                        <h2 className="mb-3 font-semibold">Customer</h2>
                        {order.customer ? (
                            <div className="text-sm text-slate-700">
                                <div>{order.customer.name}</div>
                                <div>{order.customer.email}</div>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500">No customer.</p>
                        )}
                    </section>

                    <section className="rounded-lg border border-slate-200 bg-white p-5">
                        <h2 className="mb-3 font-semibold">Items</h2>
                        <ul className="divide-y divide-slate-100">
                            {order.items.map((item) => (
                                <li
                                    key={item.rid}
                                    className="flex items-start justify-between gap-4 py-3 text-sm"
                                >
                                    <div>
                                        <div className="font-medium">{item.productName}</div>
                                        {(item.variantName || item.sku) && (
                                            <div className="text-slate-500">
                                                {[item.variantName, item.sku].filter(Boolean).join(' · ')}
                                            </div>
                                        )}
                                        <div className="text-slate-500">Qty {item.quantity}</div>
                                        {item.sourceCurrencyCode && item.sourceCurrencyCode !== order.currencyCode && item.sourceUnitPrice !== null && (
                                            <div className="text-slate-500">
                                                Listed at {formatMoney(item.sourceUnitPrice, item.sourceCurrencyCode)} each
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        {(item.unitPrice * item.quantity).toFixed(2)}{' '}
                                        {order.currencyCode}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="rounded-lg border border-slate-200 bg-white p-5">
                        <h2 className="mb-3 font-semibold">Payments</h2>
                        {order.payments.length === 0 ? (
                            <p className="text-sm text-slate-500">No payments recorded.</p>
                        ) : (
                            <ul className="space-y-2 text-sm">
                                {order.payments.map((payment) => (
                                    <li
                                        key={payment.rid}
                                        className="flex justify-between gap-4 border-b border-slate-100 pb-2"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2 font-medium">
                                                {paymentProviderLabel(payment.provider)}
                                                <PaymentStatusBadge status={payment.status} />
                                            </div>
                                            <div className="text-slate-500">
                                                {payment.externalReference ?? payment.rid}
                                            </div>
                                        </div>
                                        <div>{formatMoney(payment.amount, payment.currencyCode)}</div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>

                <div className="space-y-4">
                    <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
                        <h2 className="mb-3 font-semibold">Summary</h2>
                        <dl className="space-y-2">
                            <Row label="Status" value={ORDER_STATUS_LABELS[order.status] ?? order.status} />
                            <Row label="Payment" value={<OrderPaymentStatusBadge status={order.paymentStatus} />} />
                            <Row
                                label="Payment method"
                                value={order.paymentMethod ? paymentProviderLabel(order.paymentMethod) : '-'}
                            />
                            <Row
                                label="Items"
                                value={formatMoney(order.itemsTotal, order.currencyCode)}
                            />
                            <Row
                                label="Discount"
                                value={formatMoney(order.itemsDiscount, order.currencyCode)}
                            />
                            <Row
                                label="Shipping"
                                value={formatMoney(order.shipping, order.currencyCode)}
                            />
                            {order.taxLines.length === 0 ? (
                                <Row label="Tax" value={`${order.tax.toFixed(2)} ${order.currencyCode}`} />
                            ) : (
                                order.taxLines.map((line) => (
                                    <Row
                                        key={line.name}
                                        label={`${line.name} (${line.ratePercent}%)`}
                                        value={formatMoney(line.amount, order.currencyCode)}
                                    />
                                ))
                            )}
                            <Row
                                label="Total"
                                value={formatMoney(order.total, order.currencyCode)}
                            />
                            {order.baseCurrencyCode && order.baseCurrencyCode !== order.currencyCode && order.baseTotal !== null && (
                                <Row
                                    label={`Worth in ${order.baseCurrencyCode} (market rate)`}
                                    value={formatMoney(order.baseTotal, order.baseCurrencyCode)}
                                />
                            )}
                            <Row
                                label="Placed"
                                value={formatDateTime(order.placedAt)}
                            />
                            {canViewRequestLogs && (
                                <div className="flex justify-between gap-4 border-t border-slate-100 pt-2">
                                    <dt className="text-slate-500">Request history</dt>
                                    <dd>
                                        <Link
                                            href={route('admin.request-history.entity', {
                                                entity_type: 'App\\Models\\Order',
                                                entity_rid: order.rid,
                                            })}
                                            className="cursor-pointer underline"
                                        >
                                            View related requests
                                        </Link>
                                    </dd>
                                </div>
                            )}
                        </dl>
                    </section>

                    {order.fxRates.length > 0 && (
                        <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
                            <h2 className="mb-1 font-semibold">Exchange rates used</h2>
                            <p className="mb-3 text-slate-500">Frozen when the order was placed.</p>
                            <ul className="space-y-2">
                                {order.fxRates.map((rate) => (
                                    <li key={`${rate.from}-${rate.to}`}>
                                        <div className="font-medium">
                                            1 {rate.from} = {rate.effectiveRate.toPrecision(6)} {rate.to}
                                        </div>
                                        <div className="text-slate-500">
                                            Market {rate.midRate.toPrecision(6)} plus {rate.markupPercent}% markup
                                            {rate.fetchedAt && `, rate from ${formatDateTime(rate.fetchedAt)}`}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {canEdit && (
                        <form
                            onSubmit={submit}
                            className="rounded-lg border border-slate-200 bg-white p-5"
                        >
                            <h2 className="mb-3 font-semibold">Update status</h2>
                            <select
                                value={data.status}
                                onChange={(e) => setData('status', e.target.value)}
                                className="cursor-pointer mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            >
                                {statuses.map((status) => (
                                    <option key={status} value={status}>
                                        {ORDER_STATUS_LABELS[status] ?? status}
                                    </option>
                                ))}
                            </select>
                            {order.paymentStatus !== 'paid' && order.status !== 'cancelled' && (
                                <p className="mb-3 text-sm text-amber-800">
                                    Not paid yet, so it cannot be marked shipped or delivered.
                                </p>
                            )}
                            {errors.status && (
                                <p className="mb-2 text-sm text-red-600">{errors.status}</p>
                            )}
                            <button
                                type="submit"
                                disabled={processing}
                                className="cursor-pointer w-full rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
                            >
                                {processing ? 'Saving…' : 'Save status'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="flex justify-between gap-4">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
        </div>
    );
}
