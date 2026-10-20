import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Resets the scroll position whenever the route changes, so a new page starts at
 * the top instead of inheriting the previous page's scroll offset.
 */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname])

  return null
}
