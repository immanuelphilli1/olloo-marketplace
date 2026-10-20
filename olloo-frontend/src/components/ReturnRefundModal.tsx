import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import CheckLineIcon from 'remixicon-react/CheckLineIcon'
import CloseFillIcon from 'remixicon-react/CloseFillIcon'
import { refundCopy, returnReasons, type OrderRecord } from '../data/orders'
import { ApiError } from '../api/client'
import type { ApiReturnEligibility } from '../api/types'

type ReturnRefundModalProps = {
  order: OrderRecord | null
  onClose: () => void
  /** Opens the refund policy page. Provided by the account view, which owns routing. */
  onViewPolicy: () => void
  /** Submits the request through `POST /orders/:rid/return`. */
  onSubmit: (orderId: string, reason: string) => Promise<void>
  /**
   * Whether the order can still be returned. When the API says it cannot, the
   * dialog explains why instead of offering a form that will be rejected.
   */
  returnEligibility?: ApiReturnEligibility | null
}

/**
 * Return/Refund dialog. A return request is posted to the API with the selected
 * reason; refunds themselves are handled separately by the support team once the
 * return is approved, which the success state explains.
 */
export function ReturnRefundModal({
  order,
  onClose,
  onViewPolicy,
  onSubmit,
  returnEligibility,
}: ReturnRefundModalProps) {
  // Keyed by order so switching orders remounts with a clean form, instead of an
  // effect resetting each field after the fact.
  if (!order) return null

  return (
    <ReturnRefundDialog
      key={order.id}
      order={order}
      onClose={onClose}
      onViewPolicy={onViewPolicy}
      onSubmit={onSubmit}
      returnEligibility={returnEligibility}
    />
  )
}

function ReturnRefundDialog({
  order,
  onClose,
  onViewPolicy,
  onSubmit,
  returnEligibility,
}: {
  order: OrderRecord
  onClose: () => void
  onViewPolicy: () => void
  onSubmit: (orderId: string, reason: string) => Promise<void>
  returnEligibility?: ApiReturnEligibility | null
}) {
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // When the API has already ruled the order ineligible, the form is replaced by
  // the reason it gave rather than letting the customer submit and be rejected.
  const isIneligible = returnEligibility?.eligible === false
  const ineligibleNotice = isIneligible
    ? (returnEligibility?.reason ?? refundCopy.notEligible)
    : ''

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  useEffect(() => {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = `${scrollbarWidth}px`

    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleClose])

  const handleSubmit = async () => {
    if (!reason) return

    setIsSubmitting(true)
    setError(null)

    try {
      await onSubmit(order.id, reason)
      setIsSubmitted(true)
    } catch (submitError) {
      // The API explains rejections (e.g. a return is already open for this
      // order), so its message is more useful than a generic failure notice.
      setError(
        submitError instanceof ApiError && submitError.message
          ? submitError.message
          : refundCopy.submitError,
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close return and refund modal"
        className="fixed inset-0 z-50 bg-[rgba(0,6,7,0.3)]"
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="return-refund-title"
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-bg-primary"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border-primary px-6 py-4">
          <h2
            id="return-refund-title"
            className="min-w-0 flex-1 text-base font-semibold leading-5 tracking-[-0.32px] text-text-secondary"
          >
            Return / Refund
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center"
          >
            <CloseFillIcon className="size-6 text-text-secondary" aria-hidden />
          </button>
        </div>

        {isSubmitted ? (
          <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary-green p-2">
              <CheckLineIcon className="size-10 text-text-inverse" aria-hidden />
            </div>
            <p className="text-xl font-semibold leading-7 tracking-[-0.4px] text-text-primary">
              {refundCopy.successTitle}
            </p>
            <p className="text-base font-medium leading-5 tracking-[-0.32px] text-text-secondary">
              {refundCopy.successDescription}
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="btn-orange mt-2 flex h-11 w-full cursor-pointer items-center justify-center rounded-full px-4 text-base font-medium leading-5 tracking-[-0.32px] text-text-inverse"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 border-b border-border-primary px-6 py-4">
              <p className="text-sm leading-4.5 tracking-[-0.28px] text-text-secondary">
                {refundCopy.description}
              </p>
              <p className="text-xs font-medium leading-4 tracking-[-0.24px] text-text-tertiary">
                Order ID: <span className="text-text-primary">{order.id}</span>
              </p>
            </div>

            <div className="flex flex-col gap-3 px-6 py-4">
              {isIneligible ? (
                <p
                  role="status"
                  className="rounded-xl bg-bg-secondary px-4 py-3 text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-secondary"
                >
                  {ineligibleNotice}
                </p>
              ) : (
                <>
                  <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
                  Why are you returning this order?
                </legend>
                {returnReasons.map((option) => (
                  <label
                    key={option}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-border-primary px-4 py-3"
                  >
                    <input
                      type="radio"
                      name="return-reason"
                      value={option}
                      checked={reason === option}
                      onChange={() => setReason(option)}
                      className="size-4 accent-primary-orange"
                    />
                    <span className="text-sm font-medium leading-4 tracking-[-0.28px] text-text-primary">
                      {option}
                    </span>
                  </label>
                ))}
              </fieldset>

                  {error ? (
                    <p
                      role="alert"
                      className="rounded-xl bg-orange-light px-4 py-3 text-sm font-medium leading-4.5 tracking-[-0.28px] text-primary-orange"
                    >
                      {error}
                    </p>
                  ) : null}
                </>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-border-primary px-6 py-4">
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isIneligible || !reason || isSubmitting}
                className="btn-orange flex h-11 w-full cursor-pointer items-center justify-center rounded-full px-4 text-base font-medium leading-5 tracking-[-0.32px] text-text-inverse disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Submitting…' : refundCopy.submitLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  handleClose()
                  onViewPolicy()
                }}
                className="flex h-11 w-full cursor-pointer items-center justify-center rounded-full border border-border-secondary px-4 text-base font-medium leading-5 tracking-[-0.32px] text-text-primary"
              >
                {refundCopy.policyLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </>,
    document.body,
  )
}