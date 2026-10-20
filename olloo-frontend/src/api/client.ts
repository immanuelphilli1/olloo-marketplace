import { getApiBaseUrl } from './config'
import {
  clearAuthStorage,
  getAccessToken,
  getCartRid,
  getRefreshToken,
  setAccessToken,
  setCartRid,
  setRefreshToken,
} from './storage'
import type { ApiErrorBody, AuthResponse } from './types'

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly details?: Record<string, unknown>

  constructor(status: number, message: string, code?: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

type RequestOptions = {
  method?: string
  body?: unknown
  auth?: boolean
  cart?: boolean
  /**
   * Forces the guest `X-Cart-Id` header even when a token is present. Only the
   * endpoints that consume the guest cart to merge it into the user's cart set
   * this — everywhere else the server resolves the cart from the token and
   * ignores the header.
   */
  guestCartId?: boolean
  searchParams?: Record<string, string | number | boolean | undefined | null>
  /**
   * `Idempotency-Key` for the two order-first endpoints (`POST /orders` and
   * `POST /checkout/payment-intent`). A missing header is rejected with 428, and
   * reusing a key with a different body is rejected with 422, so the caller must
   * pass a fresh key per user action rather than a per-request one.
   */
  idempotencyKey?: string
}

let refreshPromise: Promise<boolean> | null = null

function buildUrl(path: string, searchParams?: RequestOptions['searchParams']): string {
  const url = new URL(`${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`)
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined || value === null || value === '') continue
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

function parseError(status: number, body: ApiErrorBody): ApiError {
  if (body.error) {
    return new ApiError(status, body.error.message, body.error.code, body.error.details)
  }
  if (body.message) {
    return new ApiError(status, body.message)
  }
  return new ApiError(status, `Request failed with status ${status}`)
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false

  const response = await fetch(buildUrl('/auth/refresh'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  })

  if (!response.ok) {
    clearAuthStorage()
    return false
  }

  const body = (await response.json()) as AuthResponse & { data?: AuthResponse }
  const payload = body.data ?? body
  setAccessToken(payload.accessToken)
  setRefreshToken(payload.refreshToken)
  return true
}

async function ensureRefreshedToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

function normalizeAuthResponse(body: AuthResponse & { data?: AuthResponse }): AuthResponse {
  return body.data ?? body
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
  retryOnUnauthorized = true,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey
  }

  let hasToken = false
  if (options.auth !== false) {
    const token = getAccessToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
      hasToken = true
    }
  }

  // The guest cart rid is only meaningful without a session: once authenticated,
  // the server resolves the user's cart from the token and ignores the header.
  // `guestCartId` re-enables it for the merge/place-order endpoints that
  // deliberately consume the guest cart.
  if (options.cart !== false && (!hasToken || options.guestCartId)) {
    const cartRid = getCartRid()
    if (cartRid) {
      headers['X-Cart-Id'] = cartRid
    }
  }

  const response = await fetch(buildUrl(path, options.searchParams), {
    method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const cartHeader = response.headers.get('X-Cart-Id')
  if (cartHeader) {
    setCartRid(cartHeader)
  }

  if (response.status === 401 && retryOnUnauthorized && options.auth !== false) {
    const refreshed = await ensureRefreshedToken()
    if (refreshed) {
      return apiRequest<T>(path, options, false)
    }
  }

  if (response.status === 204) {
    return undefined as T
  }

  const body = (await response.json().catch(() => ({}))) as T & ApiErrorBody
  if (!response.ok) {
    throw parseError(response.status, body)
  }

  return body
}

export function persistAuthResponse(body: AuthResponse & { data?: AuthResponse }): AuthResponse {
  const payload = normalizeAuthResponse(body)
  setAccessToken(payload.accessToken)
  setRefreshToken(payload.refreshToken)
  return payload
}
