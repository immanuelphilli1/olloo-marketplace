import type { Money } from '../api/types'

/**
 * Order-time conflicts from `POST /orders`.
 *
 * All are `409` and mean the order was **not** created, so the cart is unchanged
 * and the shopper can act and retry. They are modelled here so the checkout view
 * can explain what happened instead of showing a generic failure.
 */

/** A line whose price moved since it was added. `price_changed` only. */
export type PriceChange = {
  cartItemId: string
  previousPrice: Money
  price: Money
}

/** A line with less stock than the shopper requested. */
export type StockShortfall = {
  variantRid?: string
  requested: number
  available: number
}

export type OrderConflict = {
  code: string
  /** Shown to the shopper; written for them, not for the logs. */
  message: string
  /** Present for `price_changed`. */
  priceChanges: PriceChange[]
  /** Present for `insufficient_stock`. */
  stockShortfalls: StockShortfall[]
  /** Present for `item_unavailable`. */
  unavailableCartItemIds: string[]
  /** True when simply resubmitting is the correct next step. */
  isRetryable: boolean
}

function readMoneyArray(value: unknown): Money[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (entry): entry is Money =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as Money).amount === 'number' &&
      typeof (entry as Money).currency === 'string',
  )
}

/** Reads a conflict out of an API error's `details`, defaulting sensibly. */
export function toOrderConflict(code: string | undefined, details: unknown): OrderConflict {
  const detail = (
    typeof details === 'object' && details !== null ? details : {}
  ) as Record<string, unknown>
  const apiMessage = typeof detail.message === 'string' ? detail.message : ''

  const priceChanges = readMoneyArray(detail.items)
    .map((item) => {
      const record = item as unknown as Record<string, unknown>
      const previousPrice = record.previousPrice as Money | undefined
      const price = (record.price as Money | undefined) ?? item
      if (!previousPrice || typeof record.cartItemId !== 'string') return null
      return { cartItemId: record.cartItemId, previousPrice, price }
    })
    .filter((entry): entry is PriceChange => entry !== null)

  const stockShortfalls: StockShortfall[] = Array.isArray(detail.items)
    ? detail.items.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null) return []
        const record = entry as Record<string, unknown>
        if (typeof record.requested !== 'number' || typeof record.available !== 'number') {
          return []
        }
        return [
          {
            variantRid: typeof record.variantRid === 'string' ? record.variantRid : undefined,
            requested: record.requested,
            available: record.available,
          },
        ]
      })
    : []

  const unavailableCartItemIds = Array.isArray(detail.cartItemIds)
    ? detail.cartItemIds.filter((id): id is string => typeof id === 'string')
    : []

  switch (code) {
    case 'price_changed':
      return {
        code,
        // The shopper has not agreed to the new price yet, so retrying is only
        // valid once they have seen it.
        message:
          apiMessage ||
          'Some prices changed since you added these items. Review the new prices and place the order again.',
        priceChanges,
        stockShortfalls: [],
        unavailableCartItemIds: [],
        isRetryable: true,
      }

    case 'insufficient_stock':
      return {
        code,
        message:
          apiMessage ||
          'Some items do not have enough stock left. Lower the quantity and try again.',
        priceChanges: [],
        stockShortfalls,
        unavailableCartItemIds: [],
        isRetryable: true,
      }

    case 'item_unavailable':
      return {
        code,
        message:
          apiMessage || 'Some items are no longer available. Remove them from your cart to continue.',
        priceChanges: [],
        stockShortfalls: [],
        unavailableCartItemIds,
        isRetryable: true,
      }

    case 'currency_mismatch':
      return {
        code,
        message:
          apiMessage ||
          'Some items are priced in a different currency than the rest of your cart.',
        priceChanges: [],
        stockShortfalls: [],
        unavailableCartItemIds: [],
        isRetryable: false,
      }

    case 'cart_changed':
      return {
        code,
        message: apiMessage || 'Your cart changed while we were placing the order. Please try again.',
        priceChanges: [],
        stockShortfalls: [],
        unavailableCartItemIds: [],
        // The docs say "retry" for this one.
        isRetryable: true,
      }

    default:
      return {
        code: code ?? 'unknown',
        message: apiMessage || 'We could not place your order. Please try again.',
        priceChanges: [],
        stockShortfalls: [],
        unavailableCartItemIds: [],
        isRetryable: false,
      }
  }
}