import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import LoaderLineIcon from 'remixicon-react/LoaderLineIcon'

type PaymentRedirectOverlayProps = {
  /** True while the order is placed and provider checkout is being opened. */
  isVisible: boolean
  /** The step being performed, shown so the wait is not unexplained. */
  message: string
}

/**
 * Full-screen cover shown between submitting an order and handing off to the
 * payment provider.
 *
 * This exists because of a specific failure it prevents. Order-first checkout
 * creates the order *before* payment, and the ordered lines leave the cart
 * immediately. So on `/checkout` the cart becomes empty mid-flow, which tripped
 * the "empty cart means checkout is not valid" redirect to `/cart` and flashed
 * **"Your cart is empty"** at the shopper while their order was being created
 * and their payment page was being opened. The overlay covers the page for the
 * whole of that window, so the shopper sees an explanation instead of the cart
 * they just emptied on purpose.
 *
 * It is deliberately blocking: the page underneath is mid-transition and not
 * safe to interact with, and the whole point is to prevent that interaction.
 */
export function PaymentRedirectOverlay({
  isVisible,
  message,
}: PaymentRedirectOverlayProps) {
  // Stop the page behind scrolling while the cover is up.
  useEffect(() => {
    if (!isVisible) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isVisible])

  if (!isVisible) return null

  return createPortal(
    <div
      // `alertdialog` is deliberately not used: this is not a decision the
      // shopper makes, and it cannot be dismissed. `status` announces progress
      // politely rather than interrupting.
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-bg-primary px-6"
    >
      <LoaderLineIcon className="size-10 animate-spin text-primary-orange" aria-hidden />
      <p className="text-center text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
        {message}
      </p>
      <p className="max-w-sm text-center text-sm leading-4.5 tracking-[-0.28px] text-text-secondary">
        Do not close this window. You are being taken to our secure payment provider to complete
        payment.
      </p>
    </div>,
    document.body,
  )
}