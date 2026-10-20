/**
 * The order just placed, carried from checkout to the confirmation page.
 *
 * Order-first checkout creates the order *before* payment, so by the time the
 * shopper reaches the confirmation page the order already exists and the API is
 * the authority on it. This is only the minimum needed to render that page and
 * to identify the order: `orderId` lets the page re-read the order if it needs
 * anything the placement response did not carry (the frozen shipping address in
 * particular, since `POST /orders` does not echo it back).
 */
export type LastOrder = {
  /** Rid of the created order. Used to re-read it via `GET /orders/:rid`. */
  orderId: string
  orderReference: string
  /**
   * The server's own delivery wording, frozen onto the order at placement (e.g.
   * "Estimated delivery: 3-5 business days").
   *
   * Nullable, because the API types it as `FrozenDeliveryWording | null` — an
   * order with no delivery window recorded sends null rather than an empty
   * string. It is free text that the API states must be displayed **as-is and
   * never parsed**, so it is rendered verbatim rather than being reformatted or
   * reconstructed from a day range, and omitted when null.
   */
  estimatedDelivery: string | null
}