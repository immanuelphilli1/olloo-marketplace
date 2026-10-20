import { ApiError } from '../api/client'
import { CURRENCY_MISMATCH, INSUFFICIENT_STOCK } from '../api/types'

/**
 * Explains why a cart mutation was rejected.
 *
 * `POST /cart/items` and `PATCH /cart/items/{id}` return `422
 * insufficient_stock` when the quantity exceeds stock, and `422
 * currency_mismatch` when the product is priced in a different currency than the
 * cart. Both are expected outcomes rather than bugs, so the message is written
 * for the shopper and returned as a plain string the caller can render.
 */
export function getCartErrorMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null

  switch (error.code) {
    case INSUFFICIENT_STOCK: {
      const available = error.details?.available
      if (typeof available === 'number') {
        return available === 0
          ? 'This item just sold out. Remove it from your cart to continue.'
          : `Only ${available} left in stock. Lower the quantity to continue.`
      }
      return 'There is not enough stock for that quantity.'
    }

    case CURRENCY_MISMATCH:
      return 'This item is priced in a different currency than the rest of your cart.'

    default:
      // Anything else already carries a usable server message, or is a genuine
      // failure the caller reports generically.
      return error.message || null
  }
}