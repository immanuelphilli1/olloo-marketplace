import type { LastOrder } from '../data/lastOrder'

const LAST_ORDER_KEY = 'handco.lastOrder'

/**
 * `lastOrder` is mirrored into `sessionStorage` so the confirmation page survives
 * a reload.
 *
 * `/order-complete` is a real, directly reachable route, but the order it
 * describes only exists in the shopper's recent history. Without this, a refresh
 * emptied the page's order details — which used to be hidden by hardcoded
 * placeholder values, and would otherwise read as the order having gone missing.
 *
 * `sessionStorage` matches the lifetime of the checkout handoff: scoped to the
 * tab, cleared when it closes, and never outliving the purchase it describes.
 */
export function saveLastOrder(order: LastOrder): void {
  try {
    sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order))
  } catch {
    // A full or disabled storage must not break checkout; the page still has
    // the in-memory copy for the current visit.
  }
}

export function readLastOrder(): LastOrder | null {
  try {
    const raw = sessionStorage.getItem(LAST_ORDER_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<LastOrder>
    // `orderId` is what the page re-reads the order with, so an entry without it
    // cannot be used and is treated as absent.
    if (!parsed.orderId || !parsed.orderReference) return null

    return {
      orderId: parsed.orderId,
      orderReference: parsed.orderReference,
      estimatedDelivery: parsed.estimatedDelivery ?? '',
    }
  } catch {
    return null
  }
}

export function clearLastOrder(): void {
  try {
    sessionStorage.removeItem(LAST_ORDER_KEY)
  } catch {
    // Nothing to recover from; the entry is short-lived either way.
  }
}