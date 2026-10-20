import { useEffect, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getHomePath } from '../data/shopRoutes'
import { ListingLoader } from './ListingLoader'

type RequireAuthProps = {
  children: ReactNode
  /**
   * Where to send a signed-out visitor. Defaults to the home page.
   *
   * While the session is still being restored from storage we hold on a loader
   * rather than redirecting, so a page refresh does not bounce a signed-in user
   * out to the home page before `AuthProvider` has resolved them.
   */
  redirectTo?: string
}

/**
 * Gate for signed-in-only surfaces (the account area, and anything else that
 * reads private data).
 *
 * The backend authorises its own endpoints, so this is a UX guard, not a
 * security boundary — it stops a signed-out visitor landing on a page of failed
 * requests and empty panels. Server-side authorisation on the API remains what
 * actually protects the data.
 */
export function RequireAuth({ children, redirectTo = getHomePath() }: RequireAuthProps) {
  const { authUser, isBootstrapping, requestSignIn } = useAuth()

  const isBlocked = !isBootstrapping && !authUser

  useEffect(() => {
    if (isBlocked) {
      // Asks the Nav (which owns the modal) to prompt, matching the behaviour
      // of other gated actions such as the wishlist heart.
      requestSignIn()
    }
  }, [isBlocked, requestSignIn])

  if (isBootstrapping) {
    return <ListingLoader label="Checking your session" />
  }

  if (!authUser) {
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}