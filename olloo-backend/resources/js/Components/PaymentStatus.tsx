import { Badge } from '@/Components/Form';

/**
 * Payment words staff actually use. The raw `status` value is never shown bare:
 * `needs_review` means money arrived that we could not accept, and "completed"
 * does not tell anyone whether they have been paid.
 */
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
    pending: 'Waiting for customer',
    completed: 'Paid',
    failed: 'Not paid',
    refunded: 'Refunded',
    needs_review: 'Needs your review',
};

export const PAYMENT_STATUS_TONES: Record<string, 'slate' | 'green' | 'amber' | 'sky' | 'violet' | 'red'> = {
    pending: 'amber',
    completed: 'green',
    failed: 'red',
    refunded: 'violet',
    needs_review: 'sky',
};

/** One line saying what the status means and whether staff need to act. */
export const PAYMENT_STATUS_HINTS: Record<string, string> = {
    pending: 'We are waiting to hear back from the payment company. The customer may still be paying right now.',
    completed: 'The money arrived and the order is marked paid.',
    failed: 'The payment did not go through and nothing was taken, so the customer can try again.',
    refunded: 'This money was returned to the customer.',
    needs_review: 'The payment company confirmed a charge, but it is not what we expected. Read the note below before acting.',
};

/**
 * Order-level payment words, which are a different set from the payment
 * record's own status: an order is "unpaid" while its payment may be
 * "waiting for customer".
 */
export const ORDER_PAYMENT_STATUS_LABELS: Record<string, string> = {
    unpaid: 'Not paid yet',
    paid: 'Paid',
    failed: 'Not paid',
    refunded: 'Refunded',
};

export const ORDER_PAYMENT_STATUS_TONES: Record<string, 'slate' | 'green' | 'amber' | 'sky' | 'violet' | 'red'> = {
    unpaid: 'slate',
    paid: 'green',
    failed: 'red',
    refunded: 'violet',
};

export function OrderPaymentStatusBadge({ status }: { status: string }) {
    return <Badge tone={ORDER_PAYMENT_STATUS_TONES[status] ?? 'slate'}>{ORDER_PAYMENT_STATUS_LABELS[status] ?? status}</Badge>;
}

/** Provider names, so staff see "Stripe" rather than a config key. */
export const PAYMENT_PROVIDER_LABELS: Record<string, string> = {
    stripe: 'Stripe',
    paystack: 'Paystack',
    paypal: 'PayPal',
    tabby: 'Tabby',
    tamara: 'Tamara',
    // Local and test only: FakeGateway throws in production, so this never
    // carries real money and should not be mistaken for a provider.
    fake: 'Test gateway (no real money)',
};

export function paymentStatusLabel(status: string): string {
    return PAYMENT_STATUS_LABELS[status] ?? status;
}

export function paymentProviderLabel(provider: string): string {
    return PAYMENT_PROVIDER_LABELS[provider] ?? provider;
}

export function PaymentStatusBadge({ status }: { status: string }) {
    return <Badge tone={PAYMENT_STATUS_TONES[status] ?? 'slate'}>{paymentStatusLabel(status)}</Badge>;
}

/** Money for a human: 1234.5 AED reads as "AED 1,234.50". */
export function formatMoney(amount: number, currencyCode: string): string {
    try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(amount);
    } catch {
        return `${amount.toFixed(2)} ${currencyCode}`;
    }
}

/** Totals arrive per currency, so never add them together. */
export function formatTotals(totals: Array<{ currency: string; amount: number }>): string {
    if (totals.length === 0) return '-';
    if (totals.length === 1) return formatMoney(totals[0].amount, totals[0].currency);

    return totals.map((total) => formatMoney(total.amount, total.currency)).join(' + ');
}

export function formatDateTime(value: string | null | undefined): string {
    return value ? new Date(value).toLocaleString() : '-';
}

/** "3 minutes ago" answers "is this still moving?" better than a timestamp. */
export function timeAgo(value: string | null | undefined): string {
    if (!value) return '';

    const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
    if (seconds < 60) return 'just now';

    const units: Array<[limit: number, unit: Intl.RelativeTimeFormatUnit]> = [
        [3600, 'minute'],
        [86400, 'hour'],
        [604800, 'day'],
        [2592000, 'week'],
    ];

    let divisor = 1;
    for (const [limit, unit] of units) {
        if (seconds < limit) {
            return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(
                -Math.round(seconds / divisor),
                unit,
            );
        }
        divisor = limit;
    }

    return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(
        -Math.round(seconds / 2592000),
        'month',
    );
}