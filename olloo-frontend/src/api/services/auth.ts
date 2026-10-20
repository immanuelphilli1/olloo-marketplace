import { apiRequest, persistAuthResponse } from '../client'
import type { AuthUser } from '../../data/auth'
import type {
  AuthResponse,
  CheckEmailResponse,
  GoogleOAuthUrlResponse,
} from '../types'

/**
 * Shown when `POST /auth/forgot-password` returns no message body. It is
 * deliberately non-committal: the endpoint answers the same way for every
 * address to avoid revealing which emails are registered.
 */
const DEFAULT_FORGOT_PASSWORD_MESSAGE =
  'If that email exists, a reset link has been sent.'

export async function checkEmail(email: string): Promise<CheckEmailResponse> {
  return apiRequest<CheckEmailResponse>('/auth/check-email', {
    method: 'POST',
    body: { email },
    auth: false,
    cart: false,
  })
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  })
  return persistAuthResponse(response)
}

export async function register(input: {
  email: string
  password: string
  fullName: string
  country: string
}): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: {
      email: input.email,
      password: input.password,
      password_confirmation: input.password,
      fullName: input.fullName,
      country: input.country,
    },
    auth: false,
  })
  return persistAuthResponse(response)
}

export async function getMe(): Promise<{ user: AuthUser }> {
  return apiRequest<{ user: AuthUser }>('/auth/me')
}

export async function logout(): Promise<void> {
  await apiRequest<void>('/auth/logout', { method: 'POST' })
}

/**
 * Requests a password-reset email.
 *
 * Always succeeds, by design: the API answers identically whether or not the
 * address is registered, so this can never be used to discover which emails
 * have accounts. That is also why the confirmation shown to the shopper must not
 * claim the email "has been sent" outright — the backend's message is returned
 * verbatim so the neutral wording is preserved.
 */
export async function forgotPassword(email: string): Promise<string> {
  const response = await apiRequest<{ message?: string }>('/auth/forgot-password', {
    method: 'POST',
    body: { email },
    auth: false,
    cart: false,
  })

  return response?.message ?? DEFAULT_FORGOT_PASSWORD_MESSAGE
}

/**
 * Step 1 of Google sign-in: ask the API for a Google consent URL and its CSRF
 * state. The API does all the Google work, so the client needs no Google SDK,
 * client id, or client secret. No auth needed; a fresh pair is required on every
 * click because `state` is single-use.
 */
export async function getGoogleOAuthUrl(): Promise<GoogleOAuthUrlResponse> {
  return apiRequest<GoogleOAuthUrlResponse>('/auth/oauth/google/url', {
    method: 'GET',
    auth: false,
    cart: false,
  })
}

/**
 * Step 2: trade the one-time `code` from Google's callback for a session. Sends
 * the guest `X-Cart-Id` so the guest cart merges into the account's cart, and
 * stores the tokens exactly as email sign-in does.
 */
export async function oauthGoogleSignIn(input: {
  code: string
  state: string
}): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>('/auth/oauth/google', {
    method: 'POST',
    body: input,
    auth: false,
  })
  return persistAuthResponse(response)
}
