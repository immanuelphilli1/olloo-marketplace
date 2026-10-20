/**
 * What checkout must remember across the provider redirect.
 *
 * Order-first checkout creates the order *before* payment, so the order already
 * exists and holds stock by the time the shopper leaves the site. Only the
 * payment details are pending, which is what the return leg needs to poll
 * `GET /payments/{paymentId}`.
 *
 * The provider return URL only carries the payment reference, so the rest is
 * persisted (see `api/pendingPayment.ts`) rather than held in React state, which
 * a full page load to the provider would discard.
 */
export type PendingPayment = {
  paymentRid: string
  provider: string
  /** The order awaiting this payment. Created before the redirect. */
  orderId: string
  orderReference: string
  /**
   * Delivery wording frozen onto the order at placement. Nullable per the API —
   * it is `FrozenDeliveryWording | null`, not an empty string.
   */
  estimatedDelivery: string | null
}