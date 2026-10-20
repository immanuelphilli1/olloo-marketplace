import { apiRequest } from '../client'
import type {
  CartSummary,
  CheckoutPreviewResponse,
  Money,
  ApiDeliveryDays,
  PaymentIntentResponse,
  PaymentStatusResponse,
  PlaceOrderResponse,
} from '../types'

export async function getCheckoutPreview(): Promise<CheckoutPreviewResponse> {
  return apiRequest<CheckoutPreviewResponse>('/checkout/preview')
}

/**
 * A quote for one destination. `feeMoney`/`deliveryDays` are structured and are
 * formatted client-side; the deprecated `fee`/`deliveryWindow` display strings
 * are not part of this shape.
 */
export type ShippingQuote = {
  feeMoney?: Money
  deliveryDays?: ApiDeliveryDays | null
  courierLabel?: string | null
  /**
   * Cart totals recomputed for this destination, including tax. This is the
   * authoritative version of the `GET /checkout/preview` summary once a
   * destination is known, because the preview has to guess a currency when it
   * has no address.
   */
  summary?: CartSummary
}

/**
 * A raw destination, for a guest who has no saved address. `country` is required
 * in place of `addressRid` and may be an ISO code, rid, or name; the remaining
 * fields are optional refinements.
 */
export type RawShippingAddress = {
  country: string
  firstName?: string
  lastName?: string
  phoneCountryCode?: string
  phoneNumber?: string
  addressLine?: string
  region?: string
  city?: string
  cityLine?: string
}

/**
 * Shipping fee and delivery window for a specific destination.
 *
 * Quoting by saved address (`addressRid`) requires auth; a guest quotes with a
 * raw address instead. This is what checkout calls when the shopper changes
 * their delivery address, because the preview prices the cart for a store
 * currency when it has no destination and so can quote the wrong fee.
 */
export async function getShippingQuote(
  address: string | RawShippingAddress,
): Promise<ShippingQuote> {
  // A bare string is a saved-address rid; an object is a guest's raw address.
  const body: RawShippingAddress | { addressRid: string } =
    typeof address === 'string' ? { addressRid: address } : address

  return apiRequest<ShippingQuote>('/checkout/shipping-quote', {
    method: 'POST',
    body,
  })
}

/**
 * Opens payment for an order created by `placeOrder`.
 *
 * Order-first checkout means this is the *second* step: the order already exists
 * and holds stock, and this opens provider checkout for exactly that order's
 * total. The backend rejects an unknown order (404 `order_not_found`), one that is
 * already paid (409 `order_already_paid`) or no longer payable (409
 * `order_not_payable`, e.g. cancelled after the payment window expired).
 *
 * A failed or abandoned payment leaves the order awaiting payment, so calling
 * this again for the same `orderId` retries it.
 *
 * `paymentRid` and `provider` must be persisted before redirecting to
 * `checkoutUrl`, because the return URL only echoes back the reference.
 */
export async function createPaymentIntent(
  orderId: string,
  idempotencyKey: string,
  paymentMethodId?: string,
): Promise<PaymentIntentResponse> {
  return apiRequest<PaymentIntentResponse>('/checkout/payment-intent', {
    method: 'POST',
    // Sent only when a method was chosen; the backend resolves either a rid or a
    // code, and the field is omitted entirely when nothing has been picked.
    body: paymentMethodId ? { orderId, paymentMethodId } : { orderId },
    idempotencyKey,
  })
}

/**
 * Authoritative payment state. The provider redirect is UX only — this endpoint
 * (plus webhooks) is the source of truth, so it is what the return page polls.
 *
 * Owner-scoped: a 404 means either an unknown rid or one belonging to another
 * user, which are deliberately indistinguishable.
 */
export async function getPaymentStatus(paymentRid: string): Promise<PaymentStatusResponse> {
  return apiRequest<PaymentStatusResponse>(`/payments/${paymentRid}`)
}

/**
 * Creates the order for the selected cart lines. This is the *first* step of
 * order-first checkout.
 *
 * The order is created awaiting payment with totals fixed at current prices and
 * stock held; the ordered lines leave the cart immediately. Payment is opened
 * afterwards with `createPaymentIntent(orderId)`.
 *
 * `paymentToken` is gone: the order no longer attaches to a pre-existing
 * payment. Instead an `Idempotency-Key` is required, and the caller must reuse
 * the same key when retrying the *same* attempt (a timeout is ambiguous and a
 * retry without the key could create a duplicate order). A retry after the
 * shopper has reviewed a `price_changed` conflict is a new decision and needs a
 * new key.
 *
 * The guest cart id accompanies the request so an unauthenticated guest cart can
 * be merged into the order.
 */
export async function placeOrder(
  input: {
    addressId: string
    cartItemIds: string[]
  },
  idempotencyKey: string,
): Promise<PlaceOrderResponse> {
  return apiRequest<PlaceOrderResponse>('/orders', {
    method: 'POST',
    body: input,
    guestCartId: true,
    idempotencyKey,
  })
}