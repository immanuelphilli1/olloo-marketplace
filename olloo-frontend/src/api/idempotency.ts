/**
 * `Idempotency-Key` generation for the order-first checkout endpoints.
 *
 * `POST /orders` and `POST /checkout/payment-intent` both require the header, and
 * the server keeps one idempotency record per key across *all* endpoints:
 *
 *  - the same key with the same body replays the stored response, which is what
 *    stops a retry after a timeout from creating a duplicate order;
 *  - the same key with a *different* body is rejected with
 *    `422 idempotency_key_reused`.
 *
 * That second rule is why this module keeps a separate key per endpoint rather
 * than one key per attempt. A single shared key looks correct — one click, one
 * key — but the two requests in a checkout never carry the same body
 * (`{addressId, cartItemIds}` then `{orderId, paymentMethodId}`), so the second
 * call would always be rejected as a reuse.
 *
 * Keys are session-scoped and held in memory only: a key is needed just while
 * the page that created it is alive, and a reload already starts a new attempt.
 */

type CheckoutAttempt = {
  /** Key for `POST /orders`. Stable for the whole attempt. */
  order: string
  /** Key for `POST /checkout/payment-intent`. Rotated when the body changes. */
  paymentIntent: string
  /**
   * What the current intent key was issued for. The body of this request is
   * `{orderId, paymentMethodId}`, so a different method is a different request
   * and needs its own key.
   */
  paymentIntentFingerprint: string
}

let currentAttempt: CheckoutAttempt | null = null

function generateKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  // Fallback for environments without `crypto.randomUUID`. The header only needs
  // to be unique per attempt, not cryptographically strong.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/**
 * The key for `POST /orders`, generated once per attempt.
 *
 * Call this for every retry of the same "Place order" click so a timeout
 * replays the first response instead of creating a second order.
 */
export function getOrderIdempotencyKey(): string {
  currentAttempt ??= {
    order: generateKey(),
    paymentIntent: generateKey(),
    paymentIntentFingerprint: '',
  }

  return currentAttempt.order
}

/**
 * The key for `POST /checkout/payment-intent`.
 *
 * Reused across retries that carry the same payment method, and rotated as soon
 * as the method changes: the shopper picking a different method after a decline
 * is a new decision with a new body, and replaying the old key would return
 * `422 idempotency_key_reused` instead of opening the new payment.
 */
export function getPaymentIntentIdempotencyKey(paymentMethodId?: string): string {
  const attempt = (currentAttempt ??= {
    order: generateKey(),
    paymentIntent: generateKey(),
    paymentIntentFingerprint: '',
  })

  const fingerprint = paymentMethodId ?? 'none'

  if (attempt.paymentIntentFingerprint !== fingerprint) {
    attempt.paymentIntent = generateKey()
    attempt.paymentIntentFingerprint = fingerprint
  }

  return attempt.paymentIntent
}

/**
 * Discards the attempt's keys so the next call starts fresh.
 *
 * Called when an attempt has definitively succeeded, or when the shopper has
 * acknowledged a conflict and is submitting again as a new decision.
 */
export function resetCheckoutAttemptKeys(): void {
  currentAttempt = null
}

/**
 * A key for a standalone `payment-intent` call, such as "Make payment" on an
 * order that is already awaiting payment.
 *
 * Those attempts sit outside the checkout flow and have no order-placement step
 * to share a key with, so each one gets its own. Call this once per click and
 * pass the result to every retry of that same click.
 */
export function createStandalonePaymentIntentKey(): string {
  return generateKey()
}