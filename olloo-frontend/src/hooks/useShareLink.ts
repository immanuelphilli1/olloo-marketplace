import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Copies or shares a URL, with a visible confirmation either way.
 *
 * The Web Share API is used when the browser supports it, because it gives the
 * user the native sheet (including their messaging apps). Where it is
 * unavailable — notably desktop Chrome and in-app browsers — the link is copied
 * to the clipboard instead. The clipboard call is wrapped because it rejects
 * when the document is not focused, which is common on mobile.
 *
 * A short-lived confirmation is shown either way so the click is never silent:
 * a button that appears to do nothing is indistinguishable from a broken one.
 */
export function useShareLink(): {
  share: (payload: { title: string; text?: string; url: string }) => Promise<void>
  /** Short status shown after a share attempt, e.g. "Link copied". */
  status: string | null
} {
  const [status, setStatus] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showStatus = useCallback((message: string) => {
    setStatus(message)

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setStatus(null), 2500)
  }, [])

  // Clears the timer on unmount so a pending timeout cannot set state after the
  // component is gone.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const copyToClipboard = useCallback(
    async (text: string) => {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text)
          return true
        } catch {
          // Permission denied or the document was not focused; fall through to
          // the legacy path below.
        }
      }

      // Fallback for browsers without the async clipboard, and for the case
      // where it rejected. Needs a real textarea because `copy` is not
      // implemented on a detached element.
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()

      try {
        return document.execCommand('copy')
      } catch {
        return false
      } finally {
        document.body.removeChild(textarea)
      }
    },
    [],
  )

  const share = useCallback(
    async ({ title, text, url }: { title: string; text?: string; url: string }) => {
      // Guard rather than assume: the API is absent in some embedded browsers
      // even when `'share' in navigator` is true.
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title, text, url })
          showStatus('Shared')
          return
        } catch (error) {
          // A user dismissing the sheet rejects the promise; that is not a
          // failure to report, and it must not fall through to a silent copy.
          if (error instanceof DOMException && error.name === 'AbortError') return
          // Any other rejection (e.g. not allowed in this context) falls back.
        }
      }

      const copied = await copyToClipboard(url)
      showStatus(copied ? 'Link copied' : 'Copy failed')
    },
    [copyToClipboard, showStatus],
  )

  return { share, status }
}