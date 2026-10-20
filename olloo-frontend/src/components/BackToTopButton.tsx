import { useEffect, useState } from 'react'
import ArrowUpSLineIcon from 'remixicon-react/ArrowUpSLineIcon'

const SCROLL_THRESHOLD = 400

export function BackToTopButton() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > SCROLL_THRESHOLD)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!isVisible) return null

  return (
    <button
      /* Hidden on mobile — bottom tab bar covers the corner */
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top"
      className="group fixed bottom-6 right-4 z-40 flex size-12 cursor-pointer items-center justify-center rounded-full bg-bg-secondary shadow-[0px_1px_4px_0px_rgba(0,0,0,0.04),0px_4px_40px_0px_rgba(0,0,0,0.08)] transition-colors hover:bg-orange-light active:bg-orange-light lg:bottom-10 lg:right-10"
    >
      <ArrowUpSLineIcon
        className="size-5 text-text-secondary transition-colors group-hover:text-primary-orange"
        aria-hidden
      />
    </button>
  )
}
