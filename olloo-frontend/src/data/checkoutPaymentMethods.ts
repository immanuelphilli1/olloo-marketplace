import { images } from '../assets/images'
import type { ApiCheckoutPaymentMethod } from '../api/types'

/**
 * The store's own currency, used when the destination is unknown. The catalog
 * prices in AED for an unknown destination, so an unknown checkout does too.
 */
export const DEFAULT_CHECKOUT_CURRENCY = 'AED'

/**
 * Currency per destination country.
 *
 * `GET /payment-methods/checkout` filters methods by currency, so asking for the
 * wrong one hides every country-scoped method — that is why mobile money (GHS,
 * GH) disappears when the store currency is requested instead. Only the countries
 * this store actually serves need an entry; anything else falls back to the
 * store currency rather than guessing.
 */
const countryCurrency: Record<string, string> = {
  GH: 'GHS',
}

/** The currency an order in `countryCode` will be billed in. */
export function getCheckoutCurrency(countryCode?: string): string {
  if (!countryCode) return DEFAULT_CHECKOUT_CURRENCY

  return countryCurrency[countryCode.toUpperCase()] ?? DEFAULT_CHECKOUT_CURRENCY
}

export type CheckoutPaymentMethod = {
  /**
   * The backend's `rid` when it has one, otherwise its `code`. This is what is
   * sent as `paymentMethodId`, which the backend accepts as either.
   */
  id: string
  label: string
  /**
   * Resolved artwork: the uploaded URL when the admin supplied one, else the
   * brand asset matching the icon key. Null when neither applies, in which case
   * the row renders its label alone rather than a broken image.
   */
  icon: string | null
  /** Secondary mark, e.g. Visa next to Mastercard on the card method. */
  secondaryIcon: string | null
  note: string
  /** True for card-based rails, which collect card details on the provider page. */
  isCard: boolean
}

/**
 * Brand artwork for the icon keys the backend uses. A key is a short artwork
 * identifier, not a URL — it must never be turned into one.
 */
const iconKeyArtwork: Record<string, string> = {
  card: images.footer.mastercard,
  credit_card: images.footer.mastercard,
  visa: images.footer.visa,
  mastercard: images.footer.mastercard,
  apple_pay: images.footer.applePay,
  google_pay: images.footer.googlePay,
  paypal: images.footer.paypal,
  mobile_money: images.footer.mobileMoney,
  tabby: images.footer.tabby,
  tamara: images.footer.tamaraIcon,
}

/**
 * The card row shows two marks. Visa is the secondary mark only when the primary
 * icon is Mastercard, so the pair is never the same brand twice.
 */
const secondaryIconKeyArtwork: Record<string, string> = {
  card: images.footer.visa,
  credit_card: images.footer.visa,
  mastercard: images.footer.visa,
}

/** Key fragments that identify a card rail, which needs the card-specific copy. */
const cardIconKeys = ['card', 'visa', 'mastercard']

/**
 * Copy shown under the selected method. Card rails collect details on the
 * provider's secure page; approval-style methods (PayPal, Tabby, Tamara)
 * redirect to the provider instead.
 */
function getMethodHint(method: Pick<CheckoutPaymentMethod, 'isCard'>): string {
  return method.isCard
    ? 'You will be redirected to a secure payment page to enter your card details.'
    : 'You will be redirected to complete this payment.'
}

/**
 * Resolves a method's artwork.
 *
 * An `iconUrl` is an uploaded path or absolute URL and is used as-is. Otherwise
 * `icon` (or `code`) is a short artwork key mapped to brand assets. Unknown keys
 * return null rather than a guessed URL, so an admin adding a method never
 * produces a broken image.
 */
function resolveArtwork(
  method: ApiCheckoutPaymentMethod,
  keyArtwork: Record<string, string>,
): string | null {
  if (method.iconUrl) return method.iconUrl

  const iconKey = method.icon?.toLowerCase().trim()
  if (iconKey && keyArtwork[iconKey]) return keyArtwork[iconKey]

  // Fall back to the code so a method with no icon set still gets brand art.
  const codeKey = method.code?.toLowerCase().trim()
  if (codeKey && keyArtwork[codeKey]) return keyArtwork[codeKey]

  return null
}

/** Normalizes an icon key or code into something comparable. */
function normalizeKey(method: ApiCheckoutPaymentMethod): string {
  return (method.icon ?? method.code ?? '').toLowerCase().trim()
}

/**
 * Maps one backend method into the shape the checkout list renders. Returns null
 * when the method carries neither an id nor a code, since there would be nothing
 * to send back as `paymentMethodId`.
 */
export function mapCheckoutPaymentMethod(
  method: ApiCheckoutPaymentMethod,
): CheckoutPaymentMethod | null {
  const id = method.rid ?? method.id ?? method.code ?? ''
  if (!id) return null

  const key = normalizeKey(method)
  const isCard = cardIconKeys.some((cardKey) => key.includes(cardKey))
  const icon = resolveArtwork(method, iconKeyArtwork)

  return {
    id,
    label: method.label,
    icon,
    secondaryIcon: isCard && icon !== images.footer.visa ? resolveArtwork(method, secondaryIconKeyArtwork) : null,
    note: '',
    isCard,
  }
}

/**
 * Maps the backend list for checkout. Availability is already filtered
 * server-side for the order's currency and destination, so an empty result means
 * the backend withheld every method — the caller shows that rather than
 * substituting a local default.
 */
export function mapCheckoutPaymentMethods(
  methods: ApiCheckoutPaymentMethod[] | undefined,
): CheckoutPaymentMethod[] {
  return (methods ?? [])
    .map(mapCheckoutPaymentMethod)
    .filter((method): method is CheckoutPaymentMethod => method !== null)
}

/**
 * Merges a second backend list into the first, keyed by the id that would be sent
 * as `paymentMethodId`. Entries already present are dropped rather than
 * duplicated, so calling this with the same list twice is a no-op.
 */
export function mergeCheckoutPaymentMethods(
  existing: CheckoutPaymentMethod[],
  additional: ApiCheckoutPaymentMethod[] | undefined,
): CheckoutPaymentMethod[] {
  const seen = new Set(existing.map((method) => method.id))
  const merged = [...existing]

  for (const method of mapCheckoutPaymentMethods(additional)) {
    if (seen.has(method.id)) continue

    seen.add(method.id)
    merged.push(method)
  }

  return merged
}

/**
 * Finds a rendered method by the id the backend echoes back. The intent response
 * may confirm the method as either a rid or a code, so both are compared.
 */
export function findCheckoutPaymentMethod(
  methods: CheckoutPaymentMethod[],
  paymentMethodId: string | undefined,
): CheckoutPaymentMethod | undefined {
  if (!paymentMethodId) return undefined

  return methods.find(
    (method) => method.id === paymentMethodId || method.id.toLowerCase() === paymentMethodId.toLowerCase(),
  )
}

export { getMethodHint }
/**
 * Error codes from `POST /checkout/payment-intent` that mean the chosen payment
 * method cannot be used, rather than the order having failed.
 *
 * - `payment_method_not_found` (404): the id is unknown, e.g. admin removed it
 *   or the list is stale.
 * - `payment_method_unavailable` (422): the method does not serve the order's
 *   currency.
 * - `payment_method_declined` (422): the provider declined this shopper. Tabby
 *   rejects in this step rather than at the provider.
 *
 * All three leave the order awaiting payment, so the shopper can retry with a
 * different method; the idempotency key is reused because that is the same
 * decision, not a new one.
 */
const paymentMethodRejectionCodes = [
  'payment_method_not_found',
  'payment_method_unavailable',
  'payment_method_declined',
]

/** True when the error means "pick a different payment method", not "order failed". */
export function isPaymentMethodRejection(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false

  const code = (error as { code?: unknown }).code
  return typeof code === 'string' && paymentMethodRejectionCodes.includes(code)
}
