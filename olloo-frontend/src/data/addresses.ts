export type AddressRecord = {
  id: string
  /** ISO 3166-1 alpha-2 country code, e.g. `GH`. Used as the catalog destination. */
  country: string
  /** Country name for display, e.g. `Ghana`. Equals `country` when not mapped. */
  countryName: string
  regionId?: string
  cityId?: string
  firstName: string
  lastName: string
  phoneCountryCode: string
  phoneNumber: string
  addressLine: string
  region: string
  city: string
  cityLine: string
  isDefault: boolean
}

export type AddressFormValues = {
  country: string
  firstName: string
  lastName: string
  phoneCountryCode: string
  phoneNumber: string
  addressLine: string
  region: string
  city: string
  isDefault: boolean
  /**
   * Lookup rids for the chosen region and city, when they came from a lookup
   * list rather than being typed. The API matches them by name otherwise, so
   * these are an accuracy improvement rather than a requirement.
   */
  regionId?: string
  cityId?: string
}

export const addressSafeguardNotice = 'All data is safeguarded'

/**
 * Fallback country list, used only if the lookup endpoint is unreachable. These
 * are country names, matching what the dropdown displays; the matching ISO codes
 * come from `fallbackCountryCodes` when the lookup has not resolved.
 */
export const addressCountries = ['United Arab Emirates', 'Ghana', 'United States', 'United Kingdom']

/** ISO codes for `addressCountries`, in the same order. */
export const fallbackCountryCodes = ['AE', 'GH', 'US', 'GB']

export const addressRegions = ['Dubai', 'Abu Dhabi', 'Greater Accra', 'Ashanti']

/**
 * A brand-new address form starts genuinely blank. It used to pre-fill a
 * hardcoded name and country code, which silently saved someone else's details
 * unless the user noticed and cleared them. Nothing is guessed here; the phone
 * country code is typed by the user alongside the number.
 */
export const emptyAddressForm: AddressFormValues = {
  country: '',
  firstName: '',
  lastName: '',
  phoneCountryCode: '',
  phoneNumber: '',
  addressLine: '',
  region: '',
  city: '',
  isDefault: false,
}

export function getAddressesEmptyStateMessage(): string {
  return "You don't have any saved addresses"
}

export function formatAddressContact(address: AddressRecord): string {
  return `${address.firstName} ${address.lastName} | ${address.phoneCountryCode} ${address.phoneNumber}`
}

export function addressToFormValues(address: AddressRecord): AddressFormValues {
  return {
    country: address.country,
    firstName: address.firstName,
    lastName: address.lastName,
    // Shown verbatim now that the field is user-entered, so an existing code like
    // "+233" is no longer rewritten into a different display form.
    phoneCountryCode: address.phoneCountryCode,
    phoneNumber: address.phoneNumber,
    addressLine: address.addressLine,
    region: address.region,
    city: address.city,
    isDefault: address.isDefault,
  }
}

export function formValuesToAddress(
  values: AddressFormValues,
  id: string,
  cityLine?: string,
): AddressRecord {
  return {
    id,
    country: values.country.trim(),
    // Filled in by the mapper; the form only carries the code.
    countryName: values.country.trim(),
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    phoneCountryCode: values.phoneCountryCode.trim(),
    phoneNumber: values.phoneNumber.trim(),
    addressLine: values.addressLine.trim(),
    region: values.region.trim(),
    city: values.city.trim(),
    cityLine: cityLine ?? `${values.city}, ${values.country}`.trim(),
    isDefault: values.isDefault,
    regionId: values.regionId,
    cityId: values.cityId,
  }
}
