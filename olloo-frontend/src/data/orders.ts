/**
 * Order lifecycle. `pending_payment` replaced `pending`, and `cancelled`
 * replaced `failed`, since an order is now created before payment.
 */
export type OrderStatus =
  | 'pending_payment'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'

export type OrderFilter = 'all' | OrderStatus | 'returns'

export type OrderRecord = {
  id: string
  status: OrderStatus
  statusDateLabel: string
  statusBadgeLabel: string
  itemCount: number
  total: string
  orderTime: string
  productImages: string[]
  /** Lines the order was placed for, used by Buy Again and the tracker. */
  lines?: OrderLine[]
}

/**
 * A single product line inside an order. The product id is what makes Buy Again
 * and Add to cart work, since the cart is keyed by product rid rather than name.
 */
export type OrderLine = {
  productId: string
  name: string
  image: string
  price: string
  quantity: number
}

/**
 * One delivery event from `GET /orders/:rid/tracking`. The API owns these labels
 * and timestamps, so the timeline renders whatever the server reports rather
 * than a client-side guess.
 */
export type OrderTrackingEvent = {
  id: string
  label: string
  description: string
  /** ISO timestamp of when the event occurred. */
  occurredAt: string
}

/**
 * Fallback stages used only when tracking has not loaded (or the request
 * failed), so the modal still shows a sensible journey instead of an empty box.
 */
export type OrderTrackingStage = {
  key: string
  label: string
  description: string
}

export type BuyAgainProduct = {
  id: string
  name: string
  price: string
  image: string
}

export const orderFilterTabs: { id: OrderFilter; label: string }[] = [
  { id: 'all', label: 'All Orders' },
  { id: 'pending_payment', label: 'Awaiting Payment' },
  { id: 'processing', label: 'Processing' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'returns', label: 'Returns' },
  { id: 'cancelled', label: 'Cancelled' },
]

export const orderTrackingStages: OrderTrackingStage[] = [
  {
    key: 'pending_payment',
    label: 'Awaiting payment',
    description: 'We have your order and are holding your items while payment completes.',
  },
  {
    key: 'processing',
    label: 'Processing',
    description: 'Payment is confirmed. Your items are being packed and prepared for dispatch.',
  },
  {
    key: 'shipped',
    label: 'Shipped',
    description: 'Your parcel is on its way with our courier partner.',
  },
  {
    key: 'delivered',
    label: 'Delivered',
    description: 'Your parcel has been delivered. We hope you love it.',
  },
]

/**
 * How far along the journey an order sits. An order is treated as complete
 * through the stage matching its own status, which is how the tracker decides
 * which steps to tick off.
 */
export function getReachedStageCount(status: OrderStatus): number {
  const stageIndex = orderTrackingStages.findIndex((stage) => stage.key === status)
  return stageIndex === -1 ? 0 : stageIndex + 1
}

/** Where an order sits against each delivery stage. */
export type OrderStageState = 'done' | 'active' | 'upcoming'

/** One row of the delivery timeline. */
export type OrderTimelineStep = {
  key: string
  label: string
  description: string
  /** ISO timestamp from the API, when the order has reached this stage. */
  occurredAt: string
  state: OrderStageState
}

/** Reduces a label to a comparable form so API wording can match a local stage. */
function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z]/g, '')
}

/**
 * Builds the full delivery timeline for an order.
 *
 * Every stage is always returned, not just the reached ones, so the shopper can
 * see what is still to come. Each stage is marked `done` when the order has
 * passed it, `active` at the stage it currently sits on, and `upcoming` beyond
 * that. A cancelled order never entered the journey, so nothing is marked.
 *
 * Timestamps come from the API's tracking events when they can be matched to a
 * stage, so the dates shown are the server's rather than the client's guess.
 */
export function buildOrderTimeline(
  status: OrderStatus,
  events: OrderTrackingEvent[],
): OrderTimelineStep[] {
  const reachedCount = getReachedStageCount(status)
  // A cancelled order has no delivery journey to report progress against.
  const effectiveReached = status === 'cancelled' ? 0 : reachedCount

  // Labels are matched first because the server's wording is authoritative. The
  // index fallback only applies when the server reported a complete timeline,
  // otherwise an event could be attached to the wrong stage.
  const matchedByLabel = new Map<string, OrderTrackingEvent>()
  const eventsByIndex = events.length === orderTrackingStages.length ? events : null

  events.forEach((event) => {
    matchedByLabel.set(normalizeLabel(event.label), event)
  })

  return orderTrackingStages.map((stage, index) => {
    const event = matchedByLabel.get(normalizeLabel(stage.label)) ?? eventsByIndex?.[index]
    const state: OrderStageState =
      index < effectiveReached ? 'done' : index === effectiveReached ? 'active' : 'upcoming'

    return {
      key: stage.key,
      label: stage.label,
      description: stage.description,
      occurredAt: state === 'upcoming' ? '' : (event?.occurredAt ?? ''),
      state,
    }
  })
}

/**
 * Reasons offered when requesting a return. These are posted verbatim as the
 * return `reason`, so they are worded for the support team that reads them.
 */
export const returnReasons = [
  'Item arrived damaged or faulty',
  'Wrong item was delivered',
  'Item does not match the description',
  'No longer needed',
  'Changed my mind',
  'Other',
]

/** Copy for the return request dialog and its submitted state. */
export const refundCopy = {
  description:
    'Tell us why you are returning this order. Our team will review your request and contact you about the next steps.',
  submitLabel: 'Submit return request',
  policyLabel: 'Read our Return & Refund Policy',
  submitError: 'We could not submit your return request. Please try again.',
  /** Shown when the API reports the order is past its return window. */
  notEligible: 'This order is outside its return window, so a return cannot be requested.',
  successTitle: 'Return request received',
  successDescription:
    'Our team will review your request and get back to you shortly. Once approved, we will arrange the refund.',
}

/**
 * Flattens every order line into a repurchase list, most recent order first and
 * de-duplicated by product. This is what "Buy this again" shows, so the sidebar
 * only ever advertises something the customer has actually bought.
 */
export function getBuyAgainProductsFromOrders(sourceOrders: OrderRecord[]): BuyAgainProduct[] {
  const seen = new Set<string>()
  const result: BuyAgainProduct[] = []

  for (const order of sourceOrders) {
    for (const line of order.lines ?? []) {
      if (seen.has(line.productId)) continue
      seen.add(line.productId)
      result.push({
        id: line.productId,
        name: line.name,
        price: line.price,
        image: line.image,
      })
    }
  }

  return result
}

export function getOrdersEmptyStateMessage(
  activeFilter: OrderFilter,
  hasSearchQuery: boolean,
): string {
  if (hasSearchQuery) {
    return 'No orders match your search'
  }

  switch (activeFilter) {
    case 'all':
      return "You don't have any orders"
    case 'processing':
      return "You don't have any processing orders"
    case 'shipped':
      return "You don't have any shipped orders"
    case 'delivered':
      return "You don't have any delivered orders"
    case 'pending_payment':
      return "You don't have any orders awaiting payment"
    case 'cancelled':
      return "You don't have any cancelled orders"
    case 'returns':
      return "You don't have any orders to return"
    default: {
      const exhaustiveCheck: never = activeFilter
      return exhaustiveCheck
    }
  }
}
