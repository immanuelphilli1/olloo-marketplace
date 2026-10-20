/**
 * Steps of the sign-in modal.
 *
 * `forgot` is the password-reset branch: it collects an email on its own and
 * asks the API for a reset link instead of checking the password.
 */
export type SignInStep = 'email' | 'password' | 'forgot'

/**
 * Copy for the password-reset view. The confirmation is deliberately neutral
 * because `POST /auth/forgot-password` always succeeds, so nothing can confirm
 * whether the address is registered.
 */
export const forgotPasswordCopy = {
  title: 'Reset your password',
  subtitle: 'Enter the email you use for H&CO and we will send you a reset link.',
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
}

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
