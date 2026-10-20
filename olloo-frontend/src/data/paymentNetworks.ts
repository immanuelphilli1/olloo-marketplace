/** A mobile-money network as `GET /payment-methods/networks` returns it. */
export type PaymentNetwork = {
  /** Enum key, e.g. `mtn`. The value to submit and to match on. */
  id: string
  /** Display name, e.g. `MTN`. */
  label: string
}

/**
 * Normalizes a network value for matching.
 *
 * The API's ids are snake_case keys (`vodafone_cash`) while a deployment may
 * echo a label (`Vodafone Cash`), so both are reduced to the same comparison
 * form. The type is declared here to keep this module free of API imports.
 */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s_-]/g, '')
}

/**
 * Resolves a stored network value to a display label.
 *
 * Saved payment methods carry the network enum key, which should not be shown
 * to a shopper verbatim. The API's own `label` is preferred. If the value is not
 * in the list — an older saved method, or a network since removed — the raw
 * value is returned rather than nothing, since showing a slightly ugly name
 * beats an empty row.
 */
export function getPaymentNetworkLabel(
  networks: PaymentNetwork[],
  network: string | null | undefined,
): string {
  if (!network) return ''

  const target = normalize(network)
  const match = networks.find((option) => normalize(option.id) === target)

  return match?.label ?? network
}