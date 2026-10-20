const STORAGE_KEY = 'handco.addAddress.residenceCountry'

/** Prefills the add-address form when the shopper is sent from checkout. */
export function writeResidenceAddressIntent(countryCode: string): void {
  const code = countryCode.trim().toUpperCase()
  if (!code) return
  try {
    sessionStorage.setItem(STORAGE_KEY, code)
  } catch {
    // sessionStorage may be unavailable
  }
}

export function readResidenceAddressIntent(): string | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw?.trim() ? raw.trim().toUpperCase() : null
  } catch {
    return null
  }
}

export function clearResidenceAddressIntent(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
