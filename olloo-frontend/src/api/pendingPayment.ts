import type { PendingPayment } from '../data/pendingPayment'

const PENDING_PAYMENT_KEY = 'handco.pendingPayment'

/**
 * The provider redirect is a full page load, so the payment checkout created must
 * survive navigation through an external site. `sessionStorage` keeps it scoped
 * to the tab and clears with it, which suits a short-lived checkout handoff.
 */
export function savePendingPayment(payment: PendingPayment): void {
  sessionStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(payment))
}

export function readPendingPayment(): PendingPayment | null {
  const raw = sessionStorage.getItem(PENDING_PAYMENT_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as PendingPayment
  } catch {
    return null
  }
}

export function clearPendingPayment(): void {
  sessionStorage.removeItem(PENDING_PAYMENT_KEY)
}