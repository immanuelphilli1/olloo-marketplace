/**
 * Client-side mirror of the API's `App\Support\GhanaPhone`, used only for
 * instant feedback and formatting. The API normalises again and is the
 * authority, so keep the prefix list in step with the backend.
 */
const MOBILE_PREFIXES = ['20', '23', '24', '25', '26', '27', '28', '50', '53', '54', '55', '56', '57', '59']

export const GHANA_PHONE_HINT = 'Enter a valid Ghana mobile number, such as 024 123 4567.'

/** The 9 national digits (`241234567`), or null when the input is not a Ghana mobile number. */
export function ghanaNationalDigits(input: string): string | null {
  const digits = input.replace(/\D+/g, '')

  let national: string | null = null
  if (digits.length === 9) national = digits
  else if (digits.length === 10 && digits.startsWith('0')) national = digits.slice(1)
  else if (digits.length === 12 && digits.startsWith('233')) national = digits.slice(3)
  else if (digits.length === 14 && digits.startsWith('00233')) national = digits.slice(5)

  return national && MOBILE_PREFIXES.includes(national.slice(0, 2)) ? national : null
}

/** `+233241234567` -> `+233 24 123 4567`; anything else is returned unchanged. */
export function formatGhanaPhone(phone: string): string {
  const national = ghanaNationalDigits(phone)
  if (!national) return phone
  return `+233 ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`
}
