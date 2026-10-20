import { apiRequest } from '../client'
import type { AddressRecord } from '../../data/addresses'
import type { AuthUser } from '../../data/auth'
import type { PaymentNetwork } from '../../data/paymentNetworks'
import type { SecuritySettings } from '../../data/profile'
import type {
  AddressesResponse,
  ApiAddress,
  ApiNotificationSetting,
  ApiPaymentMethod,
  ApiProfile,
  ApiReviewSlot,
  BrowsingHistoryResponse,
  NotificationSettingsResponse,
  PaymentMethodsResponse,
  PreferredCountryResponse,
  ProfileResponse,
  ReviewsResponse,
} from '../types'

/**
 * The profile endpoints return the profile document at the top level, while
 * older deployments nest it under `profile` and may attach a `defaultAddress`
 * alongside it. Callers should not have to care, so both shapes are normalised
 * to `{ profile, defaultAddress }`.
 */
function normalizeProfileResponse(response: ProfileResponse | ApiProfile): ProfileResponse {
  if (response && 'profile' in response && response.profile) {
    return response as ProfileResponse
  }

  return { profile: response as ApiProfile }
}

export async function getProfile(): Promise<ProfileResponse> {
  return normalizeProfileResponse(await apiRequest<ProfileResponse | ApiProfile>('/users/me/profile'))
}

/**
 * Partial profile update — only the sent fields change.
 *
 * `avatar` is a URL or path string, and `null` clears it, so it is passed
 * through verbatim rather than dropped when falsy.
 */
export async function updateProfile(input: {
  fullName?: string
  displayName?: string | null
  avatar?: string | null
}): Promise<ProfileResponse> {
  return normalizeProfileResponse(
    await apiRequest<ProfileResponse | ApiProfile>('/users/me/profile', {
      method: 'PATCH',
      body: input,
    }),
  )
}

export async function getSecurity(): Promise<SecuritySettings> {
  return apiRequest('/users/me/security')
}

/**
 * Sets the shopper's country of residence for catalog delivery quotes and tax.
 *
 * The body is `{ preferredCountry }` where the value is an ISO code, a country
 * rid, or a name, or `null` to clear the preference. The ISO code from the
 * address lookup is what the client sends when the shopper picks from the list.
 */
type PreferredCountryApiResponse = {
  preferredCountry?: unknown
  country?: unknown
}

/** Normalises API/session values (string, code object, etc.) to a stored string or null. */
export function coercePreferredCountryStoredValue(value: unknown): string | null {
  if (value === null || value === undefined) return null

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    const trimmed = String(value).trim()
    return trimmed ? trimmed : null
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['code', 'countryCode', 'rid', 'id', 'label', 'name'] as const) {
      const field = record[key]
      if (typeof field === 'string' && field.trim()) return field.trim()
    }
    if (record.country !== undefined) {
      return coercePreferredCountryStoredValue(record.country)
    }
    if (record.preferredCountry !== undefined) {
      return coercePreferredCountryStoredValue(record.preferredCountry)
    }
  }

  return null
}

function normalizePreferredCountryResponse(
  response: PreferredCountryApiResponse,
): PreferredCountryResponse {
  const raw = response.preferredCountry ?? response.country
  return { preferredCountry: coercePreferredCountryStoredValue(raw) }
}

export async function updatePreferredCountry(
  preferredCountry: string | null,
): Promise<PreferredCountryResponse> {
  const response = await apiRequest<PreferredCountryApiResponse>('/users/me/country', {
    method: 'PUT',
    body: { preferredCountry },
  })
  return normalizePreferredCountryResponse(response)
}

/** Stable `<select>` value for a country lookup row (matches PUT payload). */
export function preferredCountryOptionValue(option: LookupOption): string {
  return preferredCountryPayloadForOption(option)
}

/** Resolves stored API value to the matching option's select value. */
export function preferredCountryOptionValueForStored(
  stored: unknown,
  options: LookupOption[],
): string {
  const value = coercePreferredCountryStoredValue(stored) ?? ''
  if (!value) return ''

  const upper = value.toUpperCase()
  for (const option of options) {
    if (option.code?.toUpperCase() === upper) return preferredCountryOptionValue(option)
    if (option.rid === value) return preferredCountryOptionValue(option)
    if (option.label.toLowerCase() === value.toLowerCase()) {
      return preferredCountryOptionValue(option)
    }
  }

  return ''
}

/**
 * Two-factor provisioning, returned only by the enable call.
 *
 * The secret and the `otpauth://` URI are shown to the shopper once so they can
 * add the account to an authenticator app, and are deliberately not persisted
 * client-side — `GET /users/me/security` never returns the secret again.
 */
export type TwoFactorEnrollment = {
  enabled: boolean
  secret: string
  /** `otpauth://` provisioning URI. A QR code is rendered from this by the client. */
  otpauthUrl: string
}

/**
 * Turns on two-factor authentication and returns the provisioning data.
 *
 * Enabling is the step that mints the secret, so it is only called when the
 * shopper actually opts in. Rejects as `two_factor_already_enabled` if it is on.
 */
export async function enableTwoFactor(): Promise<TwoFactorEnrollment> {
  return apiRequest('/users/me/2fa/enable', { method: 'POST' })
}

/**
 * Turns two-factor authentication off.
 *
 * Requires the current password, since losing 2FA is what makes an account
 * recoverable if the device holding it is lost — so it must not be a one-tap
 * change.
 */
export async function disableTwoFactor(password: string): Promise<void> {
  await apiRequest('/users/me/2fa/disable', {
    method: 'POST',
    body: { password },
  })
}

export async function updateEmail(email: string, password: string): Promise<SecuritySettings> {
  return apiRequest('/users/me/email', { method: 'PATCH', body: { email, password } })
}

export async function updatePhone(phone: string): Promise<SecuritySettings> {
  return apiRequest('/users/me/phone', { method: 'PATCH', body: { phone } })
}

export async function updatePassword(
  currentPassword: string,
  password: string,
): Promise<void> {
  await apiRequest('/users/me/password', {
    method: 'PATCH',
    body: { currentPassword, password, password_confirmation: password },
  })
}

export async function deleteAccount(password: string): Promise<void> {
  await apiRequest('/users/me', { method: 'DELETE', body: { password } })
}

export async function listAddresses(): Promise<AddressesResponse | ApiAddress[]> {
  return apiRequest('/addresses')
}

export async function createAddress(
  input: Omit<AddressRecord, 'id' | 'cityLine'>,
): Promise<ApiAddress> {
  return apiRequest('/addresses', { method: 'POST', body: input })
}

export async function updateAddress(
  addressRid: string,
  input: Partial<Omit<AddressRecord, 'id' | 'cityLine'>>,
): Promise<ApiAddress> {
  return apiRequest(`/addresses/${addressRid}`, { method: 'PATCH', body: input })
}

export async function deleteAddress(addressRid: string): Promise<void> {
  await apiRequest(`/addresses/${addressRid}`, { method: 'DELETE' })
}

export async function setDefaultAddress(addressRid: string): Promise<ApiAddress> {
  return apiRequest(`/addresses/${addressRid}/default`, { method: 'PATCH', body: {} })
}

export async function duplicateAddress(addressRid: string): Promise<ApiAddress> {
  return apiRequest(`/addresses/${addressRid}/duplicate`, { method: 'POST', body: {} })
}

/**
 * Lookup rows are normalised to `{ rid, label }`. The cities endpoint takes a
 * `regionRid` (not a name), so the rid has to survive the cascade; endpoints that
 * return bare strings are given a rid equal to their label.
 */
function toLookupOptions(rows: unknown): LookupOption[] {
  if (!Array.isArray(rows)) return []

  return rows
    .map((row): LookupOption | null => {
      if (typeof row === 'string') return { rid: row, label: row }
      if (!row || typeof row !== 'object') return null

      const record = row as Record<string, unknown>
      const label =
        (typeof record.label === 'string' && record.label) ||
        (typeof record.name === 'string' && record.name) ||
        (typeof record.title === 'string' && record.title) ||
        (typeof record.code === 'string' && record.code) ||
        ''
      if (!label) return null

      const rid =
        (typeof record.rid === 'string' && record.rid) ||
        (typeof record.id === 'string' && record.id) ||
        (typeof record.code === 'string' && record.code) ||
        label

      const code = typeof record.code === 'string' ? record.code : undefined
      const phoneCode = typeof record.phoneCode === 'string' ? record.phoneCode : undefined

      return { rid, label, code, phoneCode }
    })
    .filter((row): row is LookupOption => row !== null)
}

/** Picks the first list-shaped key a lookup response might use. */
function pickRows(response: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = response[key]
    if (Array.isArray(value)) return value
  }
  return []
}

export async function getCountries(): Promise<LookupOption[]> {
  const response = await apiRequest<Record<string, unknown>>(
    '/addresses/lookup/countries',
    { auth: false, cart: false },
  )
  return toLookupOptions(pickRows(response, ['countries', 'items', 'data']))
}

export async function getRegions(country: string): Promise<LookupOption[]> {
  const response = await apiRequest<Record<string, unknown>>(
    '/addresses/lookup/regions',
    { auth: false, cart: false, searchParams: { country } },
  )
  return toLookupOptions(pickRows(response, ['regions', 'items', 'data']))
}

export async function getCities(region: string): Promise<LookupOption[]> {
  const response = await apiRequest<Record<string, unknown>>(
    '/addresses/lookup/cities',
    { auth: false, cart: false, searchParams: { region } },
  )
  return toLookupOptions(pickRows(response, ['cities', 'items', 'data']))
}

export async function listPaymentMethods(): Promise<
  PaymentMethodsResponse | ApiPaymentMethod[]
> {
  return apiRequest('/payment-methods')
}

/**
 * Saved provider tokens only. The API deliberately exposes no create or update
 * endpoint — card details are never collected by the client — so cards are
 * created on the provider side and only listed, defaulted and deleted here.
 */
export async function deletePaymentMethod(paymentMethodRid: string): Promise<void> {
  await apiRequest(`/payment-methods/${paymentMethodRid}`, { method: 'DELETE' })
}

export async function setDefaultPaymentMethod(
  paymentMethodRid: string,
): Promise<ApiPaymentMethod> {
  return apiRequest(`/payment-methods/${paymentMethodRid}/default`, {
    method: 'PATCH',
    body: {},
  })
}

/**
 * Mobile-money networks.
 *
 * The spec returns one object per network, so the rows are passed through as
 * objects — `id` is the value to submit with a method, `label` is what to show.
 */
export async function getPaymentNetworks(): Promise<PaymentNetwork[]> {
  const response = await apiRequest<{ networks?: PaymentNetwork[] }>(
    '/payment-methods/networks',
    { auth: false, cart: false },
  )
  return response.networks ?? []
}

/**
 * Trims a review list to `count` rows.
 *
 * The list endpoints return the full set with no paging metadata, so the
 * dashboard's "show a few" behaviour is applied client-side rather than by
 * asking the server for a page.
 */
function sliceReviewItems(response: ReviewsResponse, count: number): ReviewsResponse {
  const items = response.items ?? response.reviews
  if (!items || items.length <= count) return response

  const trimmed = items.slice(0, count)
  // Preserve whichever key the endpoint actually used, so callers that read
  // `items` and callers that read `reviews` both keep working.
  return response.items ? { ...response, items: trimmed } : { ...response, reviews: trimmed }
}

/**
 * Order lines awaiting review.
 *
 * The endpoint takes no query parameters and returns every waiting line as
 * `{ items }`, with no `total`/`page`/`limit` — so `count` is applied here to
 * keep the dashboard to a fixed number of rows.
 */
export async function getWaitingReviews(count = 3): Promise<ReviewsResponse> {
  const response = await apiRequest<ReviewsResponse>('/reviews/waiting')
  return sliceReviewItems(response, count)
}

/**
 * Reviews the shopper has already submitted, newest first, trimmed to `count`.
 */
export async function getReviewedReviews(count = 4): Promise<ReviewsResponse> {
  const response = await apiRequest<ReviewsResponse>('/reviews/reviewed')
  return sliceReviewItems(response, count)
}

export async function submitReview(input: {
  reviewId: string
  rating: number
  title: string
  detailedReview: string
}): Promise<ApiReviewSlot> {
  return apiRequest('/reviews', { method: 'POST', body: input })
}

export async function getBrowsingHistory(): Promise<BrowsingHistoryResponse> {
  return apiRequest('/browsing-history')
}

export async function recordBrowsingHistory(productId: string): Promise<void> {
  // Documented as "mixed": guests may record, but the Authorization header still
  // has to go out when there is a token so the view is attributed to the
  // account. Passing `auth: false` here would strip it and record nothing useful.
  await apiRequest('/browsing-history', { method: 'POST', body: { productId } })
}

/**
 * Deletes the given history entries.
 *
 * The body key is `ids` (not `rids`) and takes history *entry* rids, which are
 * the `rid` on each item rather than the product rid nested inside it. The
 * backend rejects the request when the key is wrong, so this is not
 * interchangeable with the parameter name.
 */
export async function deleteBrowsingHistory(ids: string[]): Promise<void> {
  // `minItems: 1`, so an empty list is a guaranteed 422 rather than a no-op.
  if (ids.length === 0) return
  await apiRequest('/browsing-history', { method: 'DELETE', body: { ids } })
}

export async function clearBrowsingHistory(): Promise<void> {
  await apiRequest('/browsing-history/all', { method: 'DELETE' })
}

export async function getNotificationSettings(): Promise<
  NotificationSettingsResponse | ApiNotificationSetting[]
> {
  return apiRequest('/notifications/settings')
}

export async function updateNotificationSetting(
  id: string,
  enabled: boolean,
): Promise<ApiNotificationSetting> {
  return apiRequest(`/notifications/settings/${id}`, {
    method: 'PATCH',
    body: { enabled },
  })
}

export type { AuthUser }

/**
 * One option in a country/region/city dropdown. `rid` is what the API expects in
 * the query string (e.g. `region=...` when fetching cities); `label` is shown to
 * the user, so the two are kept separate.
 *
 * Countries additionally carry `code` (ISO 3166-1 alpha-2) and `phoneCode`.
 * The address API stores the country as the code, not the name, and the
 * catalog needs the code as `?country=` for delivery quotes and tax.
 */
export type LookupOption = {
  rid: string
  label: string
  /** ISO 3166-1 alpha-2 code, for country lookups only. */
  code?: string
  /** International dialling code, for country lookups only. */
  phoneCode?: string
}

/** Value to send in `PUT /users/me/country` when the shopper picks a list row. */
export function preferredCountryPayloadForOption(option: LookupOption): string {
  return option.code ?? option.rid ?? option.label
}

/** Resolves a stored preferred country (code, rid, or name) to an ISO code for `?country=`. */
export function resolvePreferredCountryToCode(
  stored: unknown,
  options: LookupOption[],
): string | undefined {
  const value = coercePreferredCountryStoredValue(stored) ?? ''
  if (!value) return undefined

  const upper = value.toUpperCase()
  for (const option of options) {
    if (option.code?.toUpperCase() === upper) return option.code.toUpperCase()
    if (option.rid === value) return option.code?.toUpperCase() ?? undefined
    if (option.label.toLowerCase() === value.toLowerCase()) {
      return option.code?.toUpperCase()
    }
  }

  return /^[A-Za-z]{2}$/.test(value) ? upper : undefined
}

/** Label for the profile select from whatever shape the API stored. */
export function preferredCountrySelectLabel(
  stored: unknown,
  options: LookupOption[],
): string {
  const value = coercePreferredCountryStoredValue(stored) ?? ''
  if (!value) return ''

  const upper = value.toUpperCase()
  for (const option of options) {
    if (option.code?.toUpperCase() === upper) return option.label
    if (option.rid === value) return option.label
    if (option.label.toLowerCase() === value.toLowerCase()) return option.label
  }

  return options.some((option) => option.label === value) ? value : ''
}
