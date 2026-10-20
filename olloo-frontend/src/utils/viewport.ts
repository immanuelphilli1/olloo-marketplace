const VIEWPORT_CONTENT = 'width=device-width, initial-scale=1.0, viewport-fit=cover'

export function resetViewportMeta() {
  const viewport = document.querySelector('meta[name="viewport"]')
  if (!viewport) return

  viewport.setAttribute('content', VIEWPORT_CONTENT)
}

export function setupViewportReset() {
  let timeoutId = 0

  const scheduleReset = () => {
    window.clearTimeout(timeoutId)
    timeoutId = window.setTimeout(resetViewportMeta, 100)
  }

  window.addEventListener('orientationchange', scheduleReset)
  window.addEventListener('resize', scheduleReset)

  return () => {
    window.clearTimeout(timeoutId)
    window.removeEventListener('orientationchange', scheduleReset)
    window.removeEventListener('resize', scheduleReset)
  }
}
