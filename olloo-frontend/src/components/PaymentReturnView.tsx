import { useEffect, useRef, useState } from 'react'
import { checkoutApi } from '../api'
import { ApiError } from '../api/client'
import CheckLineIcon from 'remixicon-react/CheckLineIcon'
import CloseCircleLineIcon from 'remixicon-react/CloseCircleLineIcon'
import TimeLineIcon from 'remixicon-react/TimeLineIcon'
import { useShop } from '../context/ShopContext'

type PaymentReturnViewProps = {
  /** `cancel` is the provider's cancel URL; it never polls. */
  outcome: 'return' | 'cancel'
  /** The payment rid the backend attached as `?reference=`. */
  reference: string | null
  onGoHome: () => void
  onGoToCart: () => void
}

/** Terminal states stop the poll; anything else is retried. */
const SETTLED_STATUSES = new Set(['succeeded', 'failed', 'cancelled', 'refunded'])
const MAX_POLLS = 10
const POLL_INTERVAL_MS = 2000
/**
 * Statuses that are still legitimately in flight when polling gives up.
 *
 * Approval-style methods (PayPal, Tabby, Tamara) approve first and capture after,
 * so `pending` can outlive the poll budget. Reporting that as a failure would tell
 * a shopper their payment failed while it is still being captured — so the UI
 * says it is still processing and points at the order instead.
 */
const IN_FLIGHT_STATUSES = new Set(['pending'])

function PaymentMessage({
  heading,
  description,
  tone,
  onGoHome,
  onGoToCart,
}: {
  heading: string
  description: string
  tone: 'success' | 'error' | 'info'
  onGoHome: () => void
  onGoToCart: () => void
}) {
  const isSuccess = tone === 'success'
  // `info` means the payment is still in flight, so it must not read as either
  // a success or a failure: neutral colours and an hourglass rather than a tick
  // or a cross.
  const isInfo = tone === 'info'

  return (
    <section className="border-t border-border-primary px-4 pb-10 pt-6 lg:px-16 lg:pt-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="rounded-xl bg-bg-secondary p-4 text-center lg:p-6">
          <div
            className={`mx-auto flex size-32 items-center justify-center rounded-full p-2 ${
              isSuccess ? 'bg-primary-green' : isInfo ? 'bg-bg-tertiary' : 'bg-primary-orange'
            }`}
          >
            {isSuccess ? (
              <CheckLineIcon className="size-24 text-text-inverse" aria-hidden />
            ) : isInfo ? (
              <TimeLineIcon className="size-24 text-text-secondary" aria-hidden />
            ) : (
              <CloseCircleLineIcon className="size-24 text-text-inverse" aria-hidden />
            )}
          </div>
          <h1 className="mt-4 text-2xl font-medium leading-8 tracking-[-0.48px] text-text-primary lg:text-4xl lg:leading-12">
            {heading}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base leading-5 tracking-[-0.32px] text-text-secondary">
            {description}
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:justify-center">
          {isInfo ? (
            <button
              type="button"
              onClick={onGoHome}
              className="btn-orange flex h-11 w-full cursor-pointer items-center justify-center rounded-full px-4 text-base font-medium leading-5 tracking-[-0.32px] text-text-inverse lg:w-auto"
            >
              Go to home
            </button>
          ) : isSuccess ? (
            <button
              type="button"
              onClick={onGoHome}
              className="btn-orange cursor-pointer rounded-full px-6 py-4 text-base font-medium leading-5 tracking-[-0.32px] text-text-inverse"
            >
              Continue shopping
            </button>
          ) : (
            <button
              type="button"
              onClick={onGoToCart}
              className="btn-orange cursor-pointer rounded-full px-6 py-4 text-base font-medium leading-5 tracking-[-0.32px] text-text-inverse"
            >
              Back to cart
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * Landing page for the provider redirect.
 *
 * The redirect itself carries no trustworthy state — the backend only appends
 * `?reference=<payment rid>` — so the real outcome is read from
 * `GET /payments/:reference`, which is polled until the payment settles or the
 * attempt budget runs out.
 */
export function PaymentReturnView({
  outcome,
  reference,
  onGoHome,
  onGoToCart,
}: PaymentReturnViewProps) {
  const { refreshCart } = useShop()
  const [polledStatus, setPolledStatus] = useState<string | null>(null)
  const [hasSettled, setHasSettled] = useState(false)
  const pollCount = useRef(0)

  /**
   * A cancelled or reference-less return needs no request, so its outcome is
   * derived from the props rather than pushed through state from the effect.
   */
  const isPreResolved = outcome === 'cancel' || !reference
  const status = isPreResolved ? (outcome === 'cancel' ? 'cancelled' : 'unknown') : polledStatus
  const isSettled = isPreResolved || hasSettled

  useEffect(() => {
    if (isPreResolved) return

    let cancelled = false

    async function poll() {
      try {
        const payment = await checkoutApi.getPaymentStatus(reference as string)
        if (cancelled) return

        setPolledStatus(payment.status)

        if (SETTLED_STATUSES.has(payment.status)) {
          setHasSettled(true)
          // The order consumed these cart lines, so re-read the cart rather
          // than assuming its contents.
          void refreshCart().catch(() => undefined)
          return
        }
      } catch (error) {
        if (cancelled) return

        // 404 covers both an unknown rid and one owned by another user, and 401
        // means the session is gone. Neither is worth retrying.
        const status = error instanceof ApiError ? error.status : 0
        if (status === 401 || status === 404) {
          setHasSettled(true)
          setPolledStatus('unknown')
          return
        }
      }

      pollCount.current += 1
      if (pollCount.current >= MAX_POLLS) {
        setHasSettled(true)
        return
      }

      pollTimer = window.setTimeout(() => void poll(), POLL_INTERVAL_MS)
    }

    let pollTimer = 0
    void poll()

    return () => {
      cancelled = true
      window.clearTimeout(pollTimer)
    }
  }, [isPreResolved, reference, refreshCart])

  if (!isSettled) {
    return (
      <section className="border-t border-border-primary px-4 pb-10 pt-6 lg:px-16 lg:pt-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-xl bg-bg-secondary p-8 text-center">
          <span
            className="size-8 animate-spin rounded-full border-2 border-border-secondary border-t-primary-orange"
            aria-hidden
          />
          <h1 className="text-xl font-medium leading-6 tracking-[-0.4px] text-text-primary">
            Confirming your payment
          </h1>
          <p className="text-sm leading-4.5 tracking-[-0.28px] text-text-secondary">
            Do not close this page. We are checking the payment status.
          </p>
        </div>
      </section>
    )
  }

  if (status === 'succeeded') {
    return (
      <PaymentMessage
        tone="success"
        heading="Payment received"
        description="Your payment is confirmed. We are preparing your order now."
        onGoHome={onGoHome}
        onGoToCart={onGoToCart}
      />
    )
  }

  // Still `pending` after the poll budget is not a failure, so it must not be
  // reported as one.
  if (status !== null && IN_FLIGHT_STATUSES.has(status)) {
    return (
      <PaymentMessage
        tone="info"
        heading="Your payment is still processing"
        description="Your bank or payment provider is still confirming this payment. We will update your order as soon as it completes — you can safely close this page and check back shortly."
        onGoHome={onGoHome}
        onGoToCart={onGoToCart}
      />
    )
  }

  return (
    <PaymentMessage
      tone="error"
      heading={
        status === 'cancelled' ? 'Payment cancelled' : 'We could not confirm your payment'
      }
      description={
        status === 'cancelled'
          ? 'You cancelled the payment before it completed. Your cart has not been charged and is still saved.'
          : 'Your payment was not completed. Nothing has been charged — you can return to your cart and try again.'
      }
      onGoHome={onGoHome}
      onGoToCart={onGoToCart}
    />
  )
}