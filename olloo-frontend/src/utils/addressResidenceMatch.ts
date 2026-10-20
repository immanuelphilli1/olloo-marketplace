import { accountApi } from '../api'
import { resolvePreferredCountryToCode } from '../api/services/account'
import { readStoredPreferredCountry } from '../api/preferredCountry'
import type { DefaultAddress } from '../data/profile'

export type AddressResidenceMismatch = {
  addressCountryCode: string
  residenceCountryCode: string
  addressCountryLabel: string
  residenceCountryLabel: string
}

function normalizeCountryCode(code: string | undefined): string | undefined {
  const value = (code ?? '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(value) ? value : undefined
}

function countryLabelForCode(code: string, options: { label: string; code?: string }[]): string {
  const match = options.find((option) => option.code?.toUpperCase() === code.toUpperCase())
  return match?.label ?? code
}

/**
 * Returns mismatch details when the default address country and country of
 * residence resolve to different ISO codes. Returns null when they match or
 * when either side is missing (nothing to compare).
 */
export async function getAddressResidenceMismatch(
  defaultAddress: DefaultAddress | null,
  userEmail: string | undefined,
): Promise<AddressResidenceMismatch | null> {
  const addressCountryCode = normalizeCountryCode(defaultAddress?.countryCode)
  if (!addressCountryCode) return null

  const storedResidence = readStoredPreferredCountry(userEmail)
  if (!storedResidence) return null

  const countries = await accountApi.getCountries()
  const residenceCountryCode = resolvePreferredCountryToCode(storedResidence, countries)
  if (!residenceCountryCode) return null

  if (addressCountryCode === residenceCountryCode) return null

  return {
    addressCountryCode,
    residenceCountryCode,
    addressCountryLabel: countryLabelForCode(addressCountryCode, countries),
    residenceCountryLabel: countryLabelForCode(residenceCountryCode, countries),
  }
}
