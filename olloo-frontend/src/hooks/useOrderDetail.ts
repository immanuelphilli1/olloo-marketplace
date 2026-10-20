import { useCallback, useState } from 'react'
import { ordersApi } from '../api'
import { mapApiOrderLines, mapApiOrderTracking } from '../api/mappers'
import type { ApiReturnEligibility } from '../api/types'
import type { OrderLine, OrderRecord, OrderTrackingEvent } from '../data/orders'

type OrderDetailState = {
  lines: OrderLine[]
  events: OrderTrackingEvent[]
  /**
   * Whether this order can still be returned. Null until the detail is loaded or
   * when the API omits it, in which case the return option stays available and
   * the server has the final say.
   */
  returnEligibility: ApiReturnEligibility | null
  isLoading: boolean
  error: string | null
}

type UseOrderDetailResult = OrderDetailState & {
  /** Loads detail + tracking for an order, replacing anything already held. */
  loadOrderDetail: (order: OrderRecord | null) => Promise<void>
  /** Attaches lines already known, so the tracker renders items immediately. */
  seedLines: (lines: OrderLine[] | undefined) => void
  reset: () => void
}

/**
 * Loads the per-order detail the list endpoint does not return: the product
 * lines (needed by Buy Again and the tracker) and the delivery timeline.
 *
 * The detail call already embeds `tracking`, so both are read from it and the
 * dedicated `/tracking` endpoint is only used as a fallback when that copy is
 * absent.
 */
export function useOrderDetail(): UseOrderDetailResult {
  const [state, setState] = useState<OrderDetailState>({
    lines: [],
    events: [],
    returnEligibility: null,
    isLoading: false,
    error: null,
  })

  const loadOrderDetail = useCallback(async (order: OrderRecord | null) => {
    if (!order) return

    setState((current) => ({ ...current, isLoading: true, error: null }))

    try {
      const detail = await ordersApi.getOrder(order.id)

      let events = mapApiOrderTracking(detail)

      // Older responses may omit the embedded timeline; fall back to the
      // dedicated endpoint rather than showing an empty tracker.
      if (events.length === 0) {
        try {
          const tracking = await ordersApi.getOrderTracking(order.id)
          events = mapApiOrderTracking(tracking)
        } catch {
          events = []
        }
      }

      setState({
        lines: mapApiOrderLines(detail),
        events,
        returnEligibility: detail.returnEligibility ?? null,
        isLoading: false,
        error: null,
      })
    } catch {
      setState((current) => ({
        lines: current.lines,
        events: current.events,
        returnEligibility: current.returnEligibility,
        isLoading: false,
        error: 'We could not load the latest tracking for this order.',
      }))
    }
  }, [])

  const seedLines = useCallback((lines: OrderLine[] | undefined) => {
    if (!lines || lines.length === 0) return
    setState((current) => (current.lines.length > 0 ? current : { ...current, lines }))
  }, [])

  const reset = useCallback(() => {
    setState({ lines: [], events: [], returnEligibility: null, isLoading: false, error: null })
  }, [])

  return { ...state, loadOrderDetail, seedLines, reset }
}