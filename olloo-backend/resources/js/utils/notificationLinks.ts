export type NotificationData = Record<string, unknown>;

/**
 * Resolve an admin deep-link for a staff notification.
 */
export function getNotificationHref(
    type: string,
    data: NotificationData,
    route: (name: string, params?: Record<string, string>) => string,
): string | null {
    if (type === 'payment') {
        const rid = typeof data.payment_rid === 'string' ? data.payment_rid : null;
        if (rid) {
            return route('admin.payments.show', { payment: rid });
        }
    }

    if (type === 'inquiry') {
        const rid = typeof data.inquiry_rid === 'string' ? data.inquiry_rid : null;
        if (rid) {
            return route('admin.inquiries.show', { inquiry: rid });
        }
    }

    return null;
}
