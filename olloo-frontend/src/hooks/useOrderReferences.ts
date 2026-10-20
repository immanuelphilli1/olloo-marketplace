import { useEffect, useRef, useState } from 'react'
import { ordersApi } from '../api'

type UseOrderReferencesResult = {
  /** Display reference by order rid, for the orders that have resolved one. */
  references: Record<string, string>
}

/**
 * The display reference (`#HCO…`) for each order on the list.
 *
 * `GET /orders` deliberately returns a lean row — rid, status, count, total,
 * images — and does not include `orderReference`, which only `GET /orders/:rid`
 * carries. The reference is the number a shopper quotes to support, so it is
 * worth showing, but fetching a detail per visible card just to label the list
 * would put N requests behind the list it is meant to annotate.
 *
 * So the list renders first and the references fill in behind it: cards show the
 * reference as soon as its own read resolves, and orders whose read failed or is
 * still in flight simply omit the row rather than delaying or blanking the list.
 * A missing reference is a far smaller problem than a slow or empty orders page.
 */
export function useOrderReferences(orderIds: string[]): UseOrderReferencesResult {
  const [references, setReferences] = useState<Record<string, string>>({})

  // Serialized so a new array of the same ids does not restart the fetch on every
  // render, which is what the panel's `orders` would otherwise cause.
  const idsKey = orderIds.join('|')

  // Mirrors `references` so the effect can read what is already resolved without
  // depending on it. Depending on the state instead would re-run the effect after
  // every resolve and re-issue the requests it just made.
  const resolvedRef = useRef<Record<string, string>>({})

  useEffect(() => {
    const ids = idsKey ? idsKey.split('|') : []
    if (ids.length === 0) return

    let cancelled = false

    async function loadReferences() {
      // Already-known ids are skipped. The panel's search box is undebounced, so
      // `idsKey` changes on every keystroke; without this, typing one character
      // would re-request every reference already on screen.
      const pending = ids.filter((orderId) => resolvedRef.current[orderId] === undefined)
      if (pending.length === 0) return

      const entries = await Promise.all(
        pending.map(async (orderId) => {
          try {
            const detail = await ordersApi.getOrder(orderId)
            return [orderId, detail.orderReference] as const
          } catch {
            return null
          }
        }),
      )

      if (cancelled) return

      // Failed reads are dropped rather than stored as empty, so a retry on the
      // next list change can still fill them in.
      const resolved = Object.fromEntries(
        entries.filter((entry): entry is readonly [string, string] => entry !== null),
      )

      if (Object.keys(resolved).length > 0) {
        resolvedRef.current = { ...resolvedRef.current, ...resolved }
        setReferences(resolvedRef.current)
      }
    }

    void loadReferences()

    return () => {
      cancelled = true
    }
  }, [idsKey])

  return { references }
}