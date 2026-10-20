const ACCESS_TOKEN_KEY = 'handco.accessToken'
const REFRESH_TOKEN_KEY = 'handco.refreshToken'
const CART_RID_KEY = 'handco.cartRid'

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setAccessToken(token: string | null): void {
  if (token) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
  } else {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  }
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setRefreshToken(token: string | null): void {
  if (token) {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, token)
  } else {
    sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  }
}

export function getCartRid(): string | null {
  return sessionStorage.getItem(CART_RID_KEY)
}

export function setCartRid(cartRid: string | null): void {
  if (cartRid) {
    sessionStorage.setItem(CART_RID_KEY, cartRid)
  } else {
    sessionStorage.removeItem(CART_RID_KEY)
  }
}

export function clearAuthStorage(): void {
  setAccessToken(null)
  setRefreshToken(null)
}
