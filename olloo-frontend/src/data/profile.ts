export type ProfileTab = 'personal' | 'security'

export type UserProfile = {
  fullName: string
  email: string
  initials: string
}

export type DefaultAddress = {
  /**
   * The saved address's rid. `POST /orders` requires an `addressId`, so checkout
   * needs this and not just the formatted lines.
   */
  rid?: string
  contactName: string
  phone: string
  line1: string
  line2: string
  /**
   * ISO 3166-1 alpha-2 code (e.g. `AE`, `GH`) for the address country.
   *
   * The catalog needs this to resolve delivery quotes and tax, both of which the
   * API only returns for a known destination. Kept as the code rather than the
   * country name so it can be sent as `?country=` without a lookup.
   */
  countryCode?: string
}

export type PaymentMethod = {
  provider: string
  maskedEmail: string
  addedOn: string
}

export type SecuritySettings = {
  email: string
  phone: string | null
  twoFactorEnabled: boolean
}

export const profileTabs: { id: ProfileTab; label: string }[] = [
  { id: 'personal', label: 'Personal Information' },
  { id: 'security', label: 'Account & Security' },
]

export const privacyNotice =
  'Your information and privacy will be kept secure and uncompromised.'

export const accountProtectionTitle = 'Your account is protected'

export const accountProtectionDescription =
  'Your H&CO account is protected by advanced security. Keeping this information up-to-date safeguards your account even more.'

export function getProfileInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}
