import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authApi } from '../api'
import { clearAuthStorage, getAccessToken } from '../api/storage'
import type { AuthUser } from '../data/auth'

type AuthContextValue = {
  authUser: AuthUser | null
  isBootstrapping: boolean
  signIn: (email: string, password: string) => Promise<void>
  register: (input: {
    email: string
    password: string
    fullName: string
    country: string
  }) => Promise<void>
  /**
   * Adopts a session returned by a non-email flow (Google sign-in), so the app
   * does not have to re-fetch `/auth/me` after the tokens are already stored.
   */
  adoptSession: (user: AuthUser) => void
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
  /**
   * Increments whenever a signed-out user triggers a sign-in gated action (e.g.
   * tapping a wishlist heart). The Nav watches this to open the sign-in modal,
   * which lives there rather than in the provider.
   */
  signInRequestCount: number
  requestSignIn: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [signInRequestCount, setSignInRequestCount] = useState(0)

  const requestSignIn = useCallback(() => {
    setSignInRequestCount((count) => count + 1)
  }, [])

  const refreshSession = useCallback(async () => {
    if (!getAccessToken()) {
      setAuthUser(null)
      return
    }

    const { user } = await authApi.getMe()
    setAuthUser(user)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      if (!getAccessToken()) {
        if (!cancelled) setIsBootstrapping(false)
        return
      }

      try {
        const { user } = await authApi.getMe()
        if (!cancelled) setAuthUser(user)
      } catch {
        clearAuthStorage()
        if (!cancelled) setAuthUser(null)
      } finally {
        if (!cancelled) setIsBootstrapping(false)
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password)
    setAuthUser(response.user)
  }, [])

  const register = useCallback(
    async (input: { email: string; password: string; fullName: string; country: string }) => {
      const response = await authApi.register(input)
      setAuthUser(response.user)
    },
    [],
  )

  const adoptSession = useCallback((user: AuthUser) => {
    setAuthUser(user)
  }, [])

  const signOut = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Ignore logout failures and clear local session anyway.
    } finally {
      clearAuthStorage()
      setAuthUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({
      authUser,
      isBootstrapping,
      adoptSession,
      signIn,
      register,
      signOut,
      refreshSession,
      signInRequestCount,
      requestSignIn,
    }),
    [
      adoptSession,
      authUser,
      isBootstrapping,
      refreshSession,
      register,
      requestSignIn,
      signIn,
      signInRequestCount,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
