import { coercePreferredCountryStoredValue } from './services/account'

const PREFERRED_COUNTRY_CHANGED = 'handco.preferredCountry.changed'
const STORAGE_PREFIX = 'handco.preferredCountry.'

function storageKey(userKey: string): string {
  return `${STORAGE_PREFIX}${userKey}`
}

/** Last value saved via `PUT /users/me/country` for this signed-in user (this tab). */
export function readStoredPreferredCountry(userKey: string | undefined): string | null {
  if (!userKey) return null
  try {
    const raw = sessionStorage.getItem(storageKey(userKey))
    return raw?.trim() ? raw : null
  } catch {
    return null
  }
}

export function writeStoredPreferredCountry(
  userKey: string | undefined,
  preferredCountry: unknown,
): void {
  if (!userKey) return
  const stored = coercePreferredCountryStoredValue(preferredCountry)
  try {
    if (!stored) {
      sessionStorage.removeItem(storageKey(userKey))
      return
    }
    sessionStorage.setItem(storageKey(userKey), stored)
  } catch {
    // sessionStorage may be unavailable
  }
}

/** Lets catalog hooks refetch `?country=` after the profile setting changes. */
export function notifyPreferredCountryChanged(): void {
  window.dispatchEvent(new Event(PREFERRED_COUNTRY_CHANGED))
}

export function onPreferredCountryChanged(listener: () => void): () => void {
  window.addEventListener(PREFERRED_COUNTRY_CHANGED, listener)
  return () => window.removeEventListener(PREFERRED_COUNTRY_CHANGED, listener)
}
