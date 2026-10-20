export type AccountSection =
  | 'orders'
  | 'reviews'
  | 'profile'
  | 'history'
  | 'addresses'
  | 'payments'
  | 'notifications'

const accountSectionPaths: Record<AccountSection, string> = {
  orders: 'orders',
  reviews: 'reviews',
  profile: 'profile',
  history: 'history',
  addresses: 'addresses',
  payments: 'payments',
  notifications: 'notifications',
}

export function getAccountPath(section: AccountSection): string {
  return `/account/${accountSectionPaths[section]}`
}

export function parseAccountSection(param: string | undefined): AccountSection | null {
  if (!param) return null

  const match = Object.entries(accountSectionPaths).find(([, path]) => path === param)
  return match ? (match[0] as AccountSection) : null
}

/**
 * Query flag asking the Addresses panel to open its edit form on arrival, rather
 * than just showing the list. Checkout's "Edit" link appends it so the user lands
 * directly on the form for the default address.
 */
export const EDIT_DEFAULT_ADDRESS_PARAM = '?edit=default'

/** True when the address route was opened with the edit intent above. */
export function wantsDefaultAddressEdit(search: string): boolean {
  return new URLSearchParams(search).get('edit') === 'default'
}

/** Opens the add-address form prefilled for the shopper's country of residence. */
export const ADD_RESIDENCE_ADDRESS_PARAM = '?add=residence'

export function wantsResidenceAddressAdd(search: string): boolean {
  return new URLSearchParams(search).get('add') === 'residence'
}
