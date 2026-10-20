import { Badge } from '@/Components/Form';

/** Order lifecycle words, so the raw enum value never reaches a staff screen. */
export const ORDER_STATUS_LABELS: Record<string, string> = {
    pending_payment: 'Awaiting payment',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
};

const TONES: Record<string, 'slate' | 'green' | 'amber' | 'sky' | 'violet' | 'red'> = {
    pending_payment: 'amber',
    processing: 'sky',
    shipped: 'violet',
    delivered: 'green',
    cancelled: 'red',
};

export function OrderStatusBadge({ status }: { status: string }) {
    return <Badge tone={TONES[status] ?? 'slate'}>{ORDER_STATUS_LABELS[status] ?? status}</Badge>;
}