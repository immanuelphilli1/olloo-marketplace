/**
 * Delivery filter vocabulary shared by the facets normalizer and the filter panel.
 *
 * The API's delivery facet is a summary of the result set (how many products
 * ship free, which maximum windows occur) rather than a list of ready-made
 * choices, so both sides derive the same option labels from that summary. The
 * labels are what the panel stores in `filters.delivery`; they are translated
 * back into `freeDelivery` / `maxDeliveryDays` when querying.
 */

/** Label for the "ships free" option. */
export const DELIVERY_OPTION_FREE = 'Free delivery'

/** Label for the option matching products delivered within N days. */
export function getDeliveryOptionByMaxDays(days: number): string {
  return `Within ${days} days`
}

/**
 * Translates a stored delivery option back into API query params.
 *
 * Returns an empty object for an unrecognised value rather than guessing, so a
 * stale option cannot silently filter by something else.
 */
export function deliveryOptionToParams(
  option: string | undefined,
): { freeDelivery?: boolean; maxDeliveryDays?: number } {
  if (!option) return {}

  if (option === DELIVERY_OPTION_FREE) {
    return { freeDelivery: true }
  }

  const match = /^Within (\d+) days?$/.exec(option)
  if (!match) return {}

  return { maxDeliveryDays: Number.parseInt(match[1], 10) }
}