const OAUTH_STATE_KEY = 'handco.googleOauthState'
const OAUTH_RETURN_PATH_KEY = 'handco.googleOauthReturnPath'

/**
 * The callback route must never be used as a post-sign-in destination: it holds
 * a single-use code, so returning there would restart the exchange.
 */
function isCallbackPath(path: string): boolean {
  return path.startsWith('/oauth/google/callback')
}

/**
 * Google sign-in is a full-page redirect, so the `state` minted in step 1 has to
 * survive the trip through Google's site. `sessionStorage` keeps it scoped to
 * the tab, matching the pending-payment handoff.
 *
 * The state is single-use and expires after 10 minutes; it is cleared as soon as
 * the callback page reads it so a refresh cannot replay it.
 */
export function saveOAuthState(state: string): void {
  sessionStorage.setItem(OAUTH_STATE_KEY, state)
}

export function consumeOAuthState(): string | null {
  const state = sessionStorage.getItem(OAUTH_STATE_KEY)
  sessionStorage.removeItem(OAUTH_STATE_KEY)
  return state
}

export function clearOAuthState(): void {
  sessionStorage.removeItem(OAUTH_STATE_KEY)
}

/**
 * Where to land once sign-in finishes. Keeps a user who started from checkout
 * (or any deep link) from being dumped on the home page.
 */
export function saveOAuthReturnPath(path: string): void {
  if (!path || isCallbackPath(path)) return
  sessionStorage.setItem(OAUTH_RETURN_PATH_KEY, path)
}

/**
 * Reads and clears the saved path, falling back to the home page. The callback
 * path is rejected on read too, so a value stored before that guard existed
 * (or by any other writer) can never bounce the user back into the exchange.
 */
export function consumeOAuthReturnPath(fallback: string): string {
  const stored = sessionStorage.getItem(OAUTH_RETURN_PATH_KEY)
  sessionStorage.removeItem(OAUTH_RETURN_PATH_KEY)
  if (!stored || isCallbackPath(stored)) return fallback
  return stored
}