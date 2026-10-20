/**
 * Client-side formatting for the values the API now sends raw.
 *
 * Per docs/backend-docs/CLIENT-CHANGE-NOTES.md the server no longer owns wording
 * or format for amounts, dates and delivery windows, so the client renders them.
 */

const amountFormatterCache = new Map<string, Intl.NumberFormat>()

function getAmountFormatter(minimumFractionDigits: number, maximumFractionDigits: number): Intl.NumberFormat {
  const key = `${minimumFractionDigits}-${maximumFractionDigits}`
  let formatter = amountFormatterCache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits,
      maximumFractionDigits,
    })
    amountFormatterCache.set(key, formatter)
  }
  return formatter
}

/** Formats a numeric amount with grouping (e.g. `1,899.00`). */
export function formatAmountDecimal(
  amount: number,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
): string {
  const minimumFractionDigits = options?.minimumFractionDigits ?? 2
  const maximumFractionDigits = options?.maximumFractionDigits ?? 2
  return getAmountFormatter(minimumFractionDigits, maximumFractionDigits).format(amount)
}

/** Formats a `Money` value as `AED 1,899.00`. */
export function formatAmount(money: { amount: number; currency: string } | undefined | null): string {
  if (!money) return ''
  return `${money.currency} ${formatAmountDecimal(money.amount)}`
}

/**
 * Formats an ISO timestamp as a short, readable date (`Jul 7, 2026`).
 * Returns an empty string for missing or unparseable input so callers can decide
 * what to fall back to without handling a broken string.
 */
export function formatIsoDate(isoDate: string | undefined | null): string {
  if (!isoDate) return ''

  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return ''

  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Formats an ISO timestamp as `Jul 7, 2026, 3:04 PM`. */
export function formatIsoDateTime(isoDate: string | undefined | null): string {
  if (!isoDate) return ''

  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return ''

  return parsed.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Renders a day range as `2-5 business days`, collapsing the range when both ends
 * match (`3 days`) and agreeing on the unit (`1-2 day` vs `2-3 days`). A missing
 * range returns an empty string rather than a misleading guess.
 */
export function formatDeliveryDays(
  deliveryDays: { min: number; max: number } | undefined | null,
): string {
  if (!deliveryDays) return ''

  const { min, max } = deliveryDays
  const unit = max === 1 ? 'day' : 'days'

  return min === max ? `${min} ${unit}` : `${min}-${max} ${unit}`
}

/** Renders a positive discount percentage as `-18%`, matching the old badge. */
export function formatDiscountPercent(discountPercent: number | undefined | null): string {
  if (discountPercent === undefined || discountPercent === null) return ''
  if (discountPercent === 0) return ''
  return `-${discountPercent}%`
}