import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi, cartApi } from '../api'
import { ApiError } from '../api/client'
import { consumeOAuthReturnPath, consumeOAuthState } from '../api/googleOAuth'
import { Footer } from '../components/Footer'
import { Nav } from '../components/Nav'
import { ListingLoader } from '../components/ListingLoader'
import { useAuth } from '../context/AuthContext'
import { useCategoryNavigation } from '../hooks/useCategoryNavigation'
import { useShop } from '../context/ShopContext'
import { getGoogleOAuthCallbackPath, getHomePath } from '../data/shopRoutes'

/** Fallback copy per documented `error.code`, so users get actionable text. */
const ERROR_MESSAGES: Record<string, string> = {
  oauth_invalid_state: 'Your sign-in timed out. Please try again.',
  oauth_failed: 'Google sign-in failed. Please try again.',
  oauth_email_unverified: 'Your Google email is not verified. Please sign up with email instead.',
  oauth_account_conflict:
    'This email is linked to another sign-in method. Please sign in with your email and password.',
  validation_error: 'Google sign-in could not be completed. Please try again.',
}

const GENERIC_ERROR = 'Something went wrong. Please try again.'
const CANCELLED_ERROR = 'Sign-in was cancelled.'

function resolveErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code && ERROR_MESSAGES[error.code]) {
      return ERROR_MESSAGES[error.code]
    }
    if (error.message) return error.message
  }
  if (error instanceof Error && error.message) return error.message
  return 'Google sign-in failed. Please try again.'
}

/** Either the pair needed for the exchange, or the reason we cannot continue. */
type CallbackRequest =
  | { ok: false; reason: string }
  | { ok: true; code: string; state: string }

/**
 * Reads Google's callback query. The `state` is deliberately *not* compared
 * here: the saved value is single-use and must survive until the effect consumes
 * it, which keeps the CSRF check in one place.
 */
function readCallbackRequest(): CallbackRequest {
  const params = new URLSearchParams(window.location.search)

  if (params.get('error')) {
    return { ok: false, reason: CANCELLED_ERROR }
  }

  const code = params.get('code')
  const state = params.get('state')
  if (!code || !state) {
    return { ok: false, reason: GENERIC_ERROR }
  }

  return { ok: true, code, state }
}

/**
 * Landing page for Google's redirect (`/oauth/google/callback`).
 *
 * The API performs the Google exchange, so this page only has to: validate the
 * `state` against the one saved before the redirect, swap the one-time `code`
 * for a session, then hand the user back where they started.
 */
export function GoogleOAuthCallbackPage() {
  const navigate = useNavigate()
  const { adoptSession, requestSignIn } = useAuth()
  const { refreshCart, refreshWishlist } = useShop()
  const {
    categoriesTargetId,
    closeCategories,
    handleSubcategorySelect,
    isCategoriesOpen,
    toggleCategories,
    toggleCategoriesFromLinkBar,
  } = useCategoryNavigation()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleGoHome = useCallback(() => {
    navigate(getHomePath())
  }, [navigate])

  // Google codes are single-use and React StrictMode runs effects twice in
  // development, so the exchange is guarded to run exactly once. The ref is a
  // plain mutable box (not state) because it must not trigger a re-render.
  const hasRun = useRef(false)

  /**
   * Reads and validates the callback query exactly once, during the initial
   * render. Doing this in a lazy initialiser (rather than an effect) means the
   * loader never flashes for a link that is already invalid or cancelled.
   */
  const [request] = useState<CallbackRequest>(() => readCallbackRequest())

  const finish = useCallback(
    async (user: Parameters<typeof adoptSession>[0]) => {
      adoptSession(user)
      try {
        await cartApi.mergeCart()
      } catch {
        // Guest cart merge is best-effort after sign-in.
      }
      await refreshCart()
      await refreshWishlist()
      navigate(consumeOAuthReturnPath(getHomePath()), { replace: true })
    },
    [adoptSession, navigate, refreshCart, refreshWishlist],
  )

  const fail = useCallback(
    (text: string) => {
      setErrorMessage(text)
      // Reopen the sign-in modal so the user can retry without hunting for a link.
      requestSignIn()
    },
    [requestSignIn],
  )

  useEffect(() => {
    // Both branches run inside an async callback so no `setState` happens
    // synchronously in the effect body (which cascades renders). The
    // cancellation scrub is also kept off the render path.
    void (async () => {
      if (!request.ok) {
        // Scrub the query string so a cancelled or stale attempt is not replayed
        // on refresh, then surface the reason.
        consumeOAuthState()
        window.history.replaceState({}, '', getGoogleOAuthCallbackPath())
        fail(request.reason)
        return
      }

      if (hasRun.current) return
      hasRun.current = true

      // Clear the single-use code from history, then compare against the saved
      // state to protect against cross-site request forgery.
      const savedState = consumeOAuthState()
      window.history.replaceState({}, '', getGoogleOAuthCallbackPath())

      if (!savedState || request.state !== savedState) {
        fail(GENERIC_ERROR)
        return
      }

      try {
        const session = await authApi.oauthGoogleSignIn({
          code: request.code,
          state: request.state,
        })
        await finish(session.user)
      } catch (error) {
        fail(resolveErrorMessage(error))
      }
    })()
  }, [fail, finish, request])

  return (
    <>
      <Nav
        isCategoriesOpen={isCategoriesOpen}
        categoriesTargetId={categoriesTargetId}
        onToggleCategories={toggleCategories}
        onCloseCategories={closeCategories}
        onSubcategorySelect={handleSubcategorySelect}
        onAfterSignOut={handleGoHome}
        onMobileHome={handleGoHome}
      />
      <div className="mx-auto w-full min-w-0 max-w-360 overflow-x-clip bg-bg-primary">
        <main className="flex flex-col items-center gap-4 px-4 py-24">
          {errorMessage ? (
            <>
              <h1 className="text-center text-2xl font-semibold tracking-[-0.48px] text-text-primary">
                {errorMessage}
              </h1>
              <p className="text-center text-base font-medium tracking-[-0.32px] text-text-secondary">
                You can try again using the sign-in form.
              </p>
              <Link
                to={getHomePath()}
                className="btn-orange flex h-13 items-center justify-center rounded-full px-8 text-base font-medium tracking-[-0.32px] text-text-inverse"
              >
                Back to home
              </Link>
            </>
          ) : (
            <ListingLoader label="Signing you in" />
          )}
        </main>
        <Footer onOpenCategories={toggleCategoriesFromLinkBar} />
      </div>
    </>
  )
}