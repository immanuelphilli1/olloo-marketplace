/**
 * Steps of the sign-in modal. `identify` collects the phone number (or, for
 * accounts created before phone sign-in, the email).
 *
 * `forgot` is the password-reset branch: it collects an email on its own and
 * asks the API for a reset link instead of checking the password.
 */
export type SignInStep = 'identify' | 'password' | 'forgot'

/**
 * Copy for the password-reset view. The confirmation is deliberately neutral
 * because `POST /auth/forgot-password` always succeeds, so nothing can confirm
 * whether the address is registered.
 */
export const forgotPasswordCopy = {
  title: 'Reset your password',
  subtitle: 'Enter the email on your olloo account and we will send you a reset link.',
  emailPlaceholder: 'Email address',
  submitLabel: 'Send reset link',
  resendLabel: 'Resend reset link',
  /** Reassurance shown before the request is sent. */
  privacyNote: 'We will only email you if an account exists for that address.',
}

export type AuthUser = {
  displayName: string
  fullName: string
  email: string
  /** Sign-in number in E.164 (`+233...`); null for email-only accounts. */
  phone?: string | null
}

/** What the shopper signs in with: a Ghana mobile number or, for older accounts, an email. */
export type SignInCredentials = { phone: string } | { email: string }

export const defaultSignedInUser: AuthUser = {
  displayName: 'Vikers',
  fullName: 'Vikers Junior',
  email: 'vikersjunior@gmail.com',
}

export const signInLegalCopy =
  'By continuing, you agree to our Terms of Use and Privacy Policy.'

export const socialSignInProviders = [
  { id: 'google', label: 'Continue with Google' },
  { id: 'facebook', label: 'Continue with Facebook' },
  { id: 'apple', label: 'Continue with Apple' },
] as const
