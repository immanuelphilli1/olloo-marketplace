import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import AlertFillIcon from 'remixicon-react/AlertFillIcon'
import CloseFillIcon from 'remixicon-react/CloseFillIcon'

type PaymentErrorModalProps = {
  isOpen: boolean
  /** The API's message, or a shopper-safe fallback. */
  message: string
  /**
   * True when the order was created but payment could not be opened.
   *
   * This decides what the shopper can actually do next. The order is awaiting
   * payment and retriable from Your Orders, and the cart is already empty by
   * then, so resubmitting checkout is not an option — offering it would be a
   * dead button. When false, the cart is untouched and a plain retry works.
   */
  isOrderPlaced: boolean
  /** Dismisses the modal and returns to the page behind it. */
  onClose: () => void
  /**
   * Resubmits checkout. Only offered when the order was never created, since
   * that is the only case where the cart still holds the lines to order.
   */
  onRetry?: () => void
  /** Takes the shopper to the order they still owe payment on. */
  onViewOrders?: () => void
}

const titleId = 'payment-error-title'

/**
 * Shown when payment could not be started after the order was submitted.
 *
 * The two failure modes need different escapes, because order-first checkout
 * makes them genuinely different:
 *
 * - **No order created** — the cart is untouched, so resubmitting checkout is a
 *   real retry. Offered as the primary action.
 * - **Order created, payment not opened** — the ordered lines have already left
 *   the cart, so resubmitting would place a *duplicate* order or do nothing.
 *   The order is awaiting payment, so the only real path is Your Orders, where
 *   **Make payment** retries it with the same idempotency key.
 */
export function PaymentErrorModal({
  isOpen,
  message,
  isOrderPlaced,
  onClose,
  onRetry,
  onViewOrders,
}: PaymentErrorModalProps) {
  // Stops the page behind scrolling while the modal is up.
  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-50 cursor-pointer bg-[rgba(0,6,7,0.3)]"
        onClick={onClose}
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={`${titleId}-detail`}
        className="fixed left-1/2 top-1/2 z-50 flex w-[min(460px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-bg-primary"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border-primary px-6 py-4">
          <h2
            id={titleId}
            className="min-w-0 flex-1 text-base font-semibold leading-5 tracking-[-0.32px] text-text-secondary"
          >
            We could not start your payment
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center"
          >
            <CloseFillIcon className="size-6 text-text-secondary" aria-hidden />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6 py-6">
          <div className="flex items-start gap-3">
            <AlertFillIcon className="mt-0.5 size-6 shrink-0 text-primary-orange" aria-hidden />
            <p
              id={`${titleId}-detail`}
              className="min-w-0 flex-1 text-base font-medium leading-5 tracking-[-0.32px] text-text-primary"
            >
              {message}
            </p>
          </div>

          <p className="text-sm leading-4.5 tracking-[-0.28px] text-text-secondary">
            {isOrderPlaced
              ? 'Your order was created but has not been paid yet, and nothing has been charged. You can retry payment for it from your orders.'
              : 'Nothing has been charged. Please try again in a moment.'}
          </p>

          <div className="mt-2 flex flex-col gap-2">
            {/* The primary action is whichever retry is actually possible. Once
                the order exists the cart is empty, so resubmitting checkout is
                not offered -- it could place a second order. */}
            {isOrderPlaced && onViewOrders ? (
              <button
                type="button"
                onClick={onViewOrders}
                className="btn-orange flex h-11 w-full cursor-pointer items-center justify-center rounded-full px-4 text-base font-medium leading-5 tracking-[-0.32px] text-text-inverse"
              >
                Pay for this order
              </button>
            ) : null}
            {!isOrderPlaced && onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="btn-orange flex h-11 w-full cursor-pointer items-center justify-center rounded-full px-4 text-base font-medium leading-5 tracking-[-0.32px] text-text-inverse"
              >
                Try again
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="w-full cursor-pointer rounded-full px-4 py-2 text-base font-medium leading-5 tracking-[-0.32px] text-text-secondary"
            >
              {/* When an order exists both actions lead to the same place — the
                  unpaid order — so the label says where, rather than implying
                  the shopper can stay on a checkout page that no longer holds
                  anything to order. */}
              {isOrderPlaced ? 'Go to my orders' : 'Not now'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}