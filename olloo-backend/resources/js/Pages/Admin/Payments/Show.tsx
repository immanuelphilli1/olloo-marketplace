import { useState, type ReactNode } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import CopyButton from '@/Components/CopyButton';
import {
    OrderPaymentStatusBadge,
    PAYMENT_STATUS_HINTS,
    PaymentStatusBadge,
    formatDateTime,
    formatMoney,
    paymentProviderLabel,
    timeAgo,
} from '@/Components/PaymentStatus';
import { useRoute } from '@/utils/route';
import { ORDER_STATUS_LABELS } from '@/Components/OrderStatus';

type PaymentDetail = {
    rid: string;
    provider: string;
    status: string;
    amount: number;
    currencyCode: string;
    externalReference: string | null;
    checkoutUrl: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    method: string | null;
    reviewReason: string | null;
    chargedAmount: number | null;
    chargedCurrency: string | null;
    order: {
        rid: string;
        reference: string;
        status: string;
        paymentStatus: string;
        total: number;
        currencyCode: string;
    } | null;
    user: { rid: string; name: string; email: string } | null;
    webhooks: { count: number; lastReceivedAt: string | null; lastEventType: string | null };
};

type Props = {
    payment: PaymentDetail;
    canRecheck: boolean;
    canViewOrders: boolean;
    canViewWebhooks: boolean;
    webhookSearch: string;
};

type SharedProps = {
    auth?: { staff?: { permissions?: string[] } | null };
};

/**
 * The next step for someone who is not a developer. Ordered by how urgent they
 * are, and each one links to the screen where the work happens.
 */
function nextSteps(payment: PaymentDetail, canRecheck: boolean): string[] {
    switch (payment.status) {
        case 'needs_review': {
            const gap =
                payment.chargedAmount !== null && payment.chargedCurrency === payment.currencyCode
                    ? formatMoney(Math.abs(payment.amount - payment.chargedAmount), payment.currencyCode)
                    : null;

            return [
                'Read the note above, then check the same reference in the payment company dashboard to confirm what was really charged.',
                gap
                    ? `Contact the customer about the difference of ${gap}.`
                    : 'Contact the customer about the amount that was taken.',
                'Decide whether to keep the money or refund it, then do it in the payment company dashboard.',
                'Leave the status as Needs your review until you have done that. Nothing is shipped on an unreviewed payment.',
            ];
        }
        case 'pending':
            return [
                'If the customer has just paid, give it a minute and use the Check with button at the top of this page.',
                'If they paid hours ago and it still says waiting, ask them to send a screenshot of the payment.',
                'They can retry from the order page, which creates a fresh payment.',
            ];
        case 'failed':
            return [
                'Nothing was taken, so no refund is needed.',
                'Ask the customer to try paying again from the order page, optionally with a different payment method.',
                canRecheck
                    ? 'If they insist they paid, press Check with the payment company below to be sure.'
                    : 'Ask a manager to check the payment company if the customer insists they paid.',
            ];
        case 'completed':
            return [
                payment.order
                    ? 'The order is marked paid, so it can move to processing, then shipped.'
                    : 'This payment is not linked to an order, so nothing will be shipped from it.',
                'No further action is needed here.',
            ];
        case 'refunded':
            return [
                'The money was returned to the customer.',
                'Check the order payment status below, since a refund usually turns it back to unpaid.',
            ];
        default:
            return ['No action is needed for this payment.'];
    }
}

/**
 * The settlement service writes its review reason in developer terms (minor
 * units, status values). Staff need to know what to tell the customer, so the
 * same facts are restated plainly. Anything unrecognised falls back to the raw
 * reason rather than being hidden.
 */
function plainReason(payment: PaymentDetail): string {
    const charged =
        payment.chargedAmount !== null && payment.chargedCurrency
            ? formatMoney(payment.chargedAmount, payment.chargedCurrency)
            : null;
    const expected = formatMoney(payment.amount, payment.currencyCode);

    if (charged && payment.chargedCurrency && payment.chargedCurrency !== payment.currencyCode) {
        return `They took ${charged}, but this order was billed in ${payment.currencyCode} for ${expected}. Check the exchange rate they used before deciding.`;
    }

    if (charged) {
        return `They took ${charged}, but the order total was ${expected}. The amounts do not match, so we have not marked this order paid.`;
    }

    if (payment.reviewReason?.includes('already paid')) {
        return 'This order was already paid by a different payment, so this second payment was not applied to it. Check whether the customer was charged twice.';
    }

    if (payment.reviewReason?.includes('cancelled')) {
        return 'This order was cancelled before the money arrived, so the payment was not applied. Arrange a refund with the customer.';
    }

    return payment.reviewReason ?? 'The payment does not match the order.';
}

export default function Show({ payment, canRecheck, canViewOrders, canViewWebhooks, webhookSearch }: Props) {
    const route = useRoute();
    const { auth } = usePage<SharedProps>().props;
    const canViewRequestLogs = Boolean(auth?.staff?.permissions?.includes('view_request_logs'));
    const [checking, setChecking] = useState(false);

    const company = paymentProviderLabel(payment.provider);
    const canCheckNow = canRecheck && (payment.status === 'pending' || payment.status === 'failed');

    const recheck = () => {
        setChecking(true);
        router.post(
            route('admin.payments.recheck', payment.rid),
            {},
            { preserveScroll: true, onFinish: () => setChecking(false) },
        );
    };

    return (
        <AdminLayout title={`Payment ${payment.rid}`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <Link href={route('admin.payments.index')} className="cursor-pointer text-sm text-slate-600 underline">
                    Back to payments
                </Link>

                {canCheckNow && (
                    <button
                        type="button"
                        onClick={recheck}
                        disabled={checking}
                        className="cursor-pointer rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {checking ? `Asking ${company}...` : `Check with ${company}`}
                    </button>
                )}
            </div>

            <div className="space-y-4">
                <section className="rounded-lg border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <PaymentStatusBadge status={payment.status} />
                                <span className="text-sm text-slate-500">via {company}</span>
                            </div>
                            <p className="mt-2 text-2xl font-semibold text-slate-900">
                                {formatMoney(payment.amount, payment.currencyCode)}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">{PAYMENT_STATUS_HINTS[payment.status]}</p>
                        </div>
                        <div className="text-right text-sm text-slate-600">
                            <div>Received {formatDateTime(payment.createdAt)}</div>
                            <div className="text-slate-500">{timeAgo(payment.createdAt)}</div>
                        </div>
                    </div>

                    {payment.reviewReason && (
                        <div className="mt-4 rounded-md border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900">
                            <p className="font-semibold">Why this needs review</p>
                            <p className="mt-1">{plainReason(payment)}</p>
                        </div>
                    )}
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-5">
                    <h2 className="text-base font-semibold text-slate-900">What to do</h2>
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
                        {nextSteps(payment, canRecheck).map((step) => (
                            <li key={step}>{step}</li>
                        ))}
                    </ol>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-5">
                    <h2 className="text-base font-semibold text-slate-900">Customer</h2>
                    {payment.user ? (
                        <dl className="mt-3 space-y-2 text-sm">
                            <Field label="Name" value={payment.user.name} />
                            <Field label="Email" value={payment.user.email} />
                        </dl>
                    ) : (
                        <p className="mt-3 text-sm text-slate-500">
                            This payment is not linked to an account, so it was likely a guest checkout.
                        </p>
                    )}
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-5">
                    <h2 className="text-base font-semibold text-slate-900">Order</h2>
                    {payment.order ? (
                        <dl className="mt-3 space-y-2 text-sm">
                            <Field
                                label="Order number"
                                value={payment.order.reference}
                                action={
                                    <CopyButton value={payment.order.reference} label="Copy number" />
                                }
                            />
                            <Field
                                label="Order status"
                                value={ORDER_STATUS_LABELS[payment.order.status] ?? payment.order.status}
                            />
                            <Field
                                label="Order payment status"
                                value={<OrderPaymentStatusBadge status={payment.order.paymentStatus} />}
                            />
                            <Field
                                label="Order total"
                                value={formatMoney(payment.order.total, payment.order.currencyCode)}
                            />
                        </dl>
                    ) : (
                        <p className="mt-3 text-sm text-slate-500">This payment is not linked to an order.</p>
                    )}
                    {payment.order && canViewOrders && (
                        <Link
                            href={route('admin.orders.show', payment.order.rid)}
                            className="mt-3 inline-block cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                        >
                            Open the order
                        </Link>
                    )}
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-5">
                    <h2 className="text-base font-semibold text-slate-900">History</h2>
                    <dl className="mt-3 space-y-2 text-sm">
                        <Field label="Started" value={formatDateTime(payment.createdAt)} />
                        <Field label="Last updated" value={formatDateTime(payment.updatedAt)} />
                        <Field
                            label="Payment company messages"
                            value={
                                payment.webhooks.count === 0
                                    ? 'None received yet'
                                    : `${payment.webhooks.count} received, last ${timeAgo(payment.webhooks.lastReceivedAt) || formatDateTime(payment.webhooks.lastReceivedAt)}`
                            }
                            action={
                                canViewWebhooks && payment.webhooks.count > 0 ? (
                                    <Link
                                        href={route('admin.webhooks.index', { search: webhookSearch })}
                                        className="cursor-pointer text-xs underline"
                                    >
                                        View messages
                                    </Link>
                                ) : undefined
                            }
                        />
                    </dl>
                </section>

                <details className="rounded-lg border border-slate-200 bg-white p-5">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700">
                        Technical details (for your developer)
                    </summary>
                    <dl className="mt-3 space-y-2 text-sm">
                        <Field label="Payment reference" value={payment.rid} action={<CopyButton value={payment.rid} label="Copy reference" />} />
                        <Field
                            label={`${company} reference`}
                            value={payment.externalReference ?? '-'}
                            action={
                                payment.externalReference ? (
                                    <CopyButton value={payment.externalReference} label="Copy reference" />
                                ) : undefined
                            }
                        />
                        <Field label="Method" value={payment.method ?? '-'} />
                        <Field label="Checkout link" value={payment.checkoutUrl ?? '-'} />
                        {payment.reviewReason && <Field label="Raw review reason" value={payment.reviewReason} />}
                    </dl>
                    {canViewRequestLogs && (
                        <Link
                            href={route('admin.request-history.entity', {
                                entity_type: 'App\\Models\\Payment',
                                entity_rid: payment.rid,
                            })}
                            className="mt-3 inline-block cursor-pointer text-sm underline"
                        >
                            View request history
                        </Link>
                    )}
                </details>
            </div>
        </AdminLayout>
    );
}

function Field({
    label,
    value,
    action,
}: {
    label: string;
    value: ReactNode;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-slate-500">{label}</dt>
            <dd className="flex items-center gap-2 text-slate-900">
                <span className="break-all">{value}</span>
                {action}
            </dd>
        </div>
    );
}