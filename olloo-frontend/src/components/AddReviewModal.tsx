import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { accountApi } from '../api'
import { getReviewErrorMessage } from '../data/reviewErrors'
import CheckLineIcon from 'remixicon-react/CheckLineIcon'
import CloseFillIcon from 'remixicon-react/CloseFillIcon'
import StarFillIcon from 'remixicon-react/StarFillIcon'
import StarLineIcon from 'remixicon-react/StarLineIcon'
import type { ReviewSubmission, SubmittedReview, WaitingReviewRecord } from '../data/reviews'

type AddReviewModalProps = {
  review: WaitingReviewRecord | null
  onClose: () => void
  onSubmitSuccess?: (submitted: SubmittedReview) => void
}

function ReviewStarRating({
  value,
  onChange,
}: {
  value: number
  onChange: (rating: number) => void
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Star rating">
      {Array.from({ length: 5 }, (_, index) => {
        const starValue = index + 1
        const isFilled = starValue <= value
        const Icon = isFilled ? StarFillIcon : StarLineIcon

        return (
          <button
            key={starValue}
            type="button"
            role="radio"
            aria-checked={value === starValue}
            aria-label={`${starValue} star${starValue === 1 ? '' : 's'}`}
            onClick={() => onChange(starValue)}
            className="cursor-pointer p-0.5"
          >
            <Icon
              className={`size-8 ${isFilled ? 'text-primary-gold' : 'text-bg-tertiary'}`}
              aria-hidden
            />
          </button>
        )
      })}
    </div>
  )
}

function FloatingField({
  id,
  label,
  value,
  onChange,
  multiline = false,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
}) {
  const sharedClassName =
    'w-full resize-none bg-transparent text-base font-medium leading-5 tracking-[-0.32px] text-text-primary outline-none placeholder:text-transparent'

  return (
    <label
      htmlFor={id}
      className={`flex w-full flex-col justify-center overflow-hidden rounded-2xl border-[1.5px] border-border-primary px-4 ${
        multiline ? 'min-h-50 py-4' : 'h-14'
      }`}
    >
      <span className="text-xs font-medium leading-4 tracking-[-0.24px] text-text-secondary">
        {label}
      </span>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${sharedClassName} min-h-24 flex-1`}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={sharedClassName}
        />
      )}
    </label>
  )
}

function ReviewSuccessContent({ onClose }: { onClose: () => void }) {
  return (
    <div className="relative flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-2 top-2 flex cursor-pointer items-center rounded-full bg-bg-secondary p-2"
      >
        <CloseFillIcon className="size-6 text-text-secondary" aria-hidden />
      </button>

      <div className="flex size-24 items-center justify-center rounded-full bg-primary-green p-1.5">
        <CheckLineIcon className="size-18 text-text-inverse" aria-hidden />
      </div>

      <h2
        id="review-success-title"
        className="text-center text-2xl font-semibold leading-8 tracking-[-0.48px] text-text-primary"
      >
        Thank you for your review
      </h2>

      <p className="text-center text-base font-medium leading-5 tracking-[-0.32px] text-text-secondary">
        Your review has been submitted and is awaiting approval. It will appear on the product
        once our team has reviewed it. We appreciate your feedback and hope to see you again soon.
      </p>
    </div>
  )
}

export function AddReviewModal({ review, onClose, onSubmitSuccess }: AddReviewModalProps) {
  // The parent keys this component by review id, so every fresh target starts
  // from blank state in its first render. Deriving that reset from the prop in
  // an effect would instead paint one frame carrying the previous review.
  const [rating, setRating] = useState(0)
  const [title, setTitle] = useState('')
  const [detailedReview, setDetailedReview] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  /** Kept so the parent can rebuild the row with what was actually submitted. */
  const [submitted, setSubmitted] = useState<SubmittedReview | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isOpen = review !== null

  /** Hands the submitted review back so the row can move to the Reviewed tab. */
  const handleClose = useCallback(() => {
    if (submitted) {
      onSubmitSuccess?.(submitted)
    }
    onClose()
  }, [submitted, onClose, onSubmitSuccess])

  useEffect(() => {
    if (!isOpen) return

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = `${scrollbarWidth}px`

    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleClose, isOpen])

  /**
   * Posts the review to the server. The success screen is only shown once the
   * call lands, so a rejected review keeps the form open with the reason.
   */
  const handleSubmit = async () => {
    if (!review) return

    if (rating === 0) {
      setErrorMessage('Please choose a star rating before submitting.')
      return
    }
    if (!title.trim()) {
      setErrorMessage('Please add a review title before submitting.')
      return
    }

    setErrorMessage(null)
    setIsSubmitting(true)

    const payload: ReviewSubmission = {
      reviewId: review.id,
      rating,
      title: title.trim(),
      detailedReview: detailedReview.trim(),
    }

    try {
      const created = await accountApi.submitReview(payload)
      setSubmitted({
        ...payload,
        // `POST /reviews` returns the moderation state it created the review
        // with, so the Reviewed tab shows the server's word rather than a guess.
        status: created?.status === 'published' ? 'published' : 'pending',
      })
      setIsSubmitted(true)
    } catch (error) {
      setErrorMessage(getReviewErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!review) return null

  const activeReview = review

  return createPortal(
    <>
      <button
        type="button"
        aria-label={isSubmitted ? 'Close review success modal' : 'Close review modal'}
        className="fixed inset-0 z-50 bg-[rgba(0,6,7,0.3)]"
        onClick={handleClose}
      />

      {isSubmitted ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-success-title"
          className="fixed left-1/2 top-1/2 z-50 w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-bg-primary p-8"
        >
          <ReviewSuccessContent onClose={handleClose} />
        </div>
      ) : (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-review-title"
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(680px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-bg-primary"
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-border-primary px-6 py-4">
            <h2
              id="add-review-title"
              className="min-w-0 flex-1 text-base font-semibold leading-5 tracking-[-0.32px] text-text-secondary"
            >
              Rate this product
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

          <div className="overflow-y-auto">
            <div className="flex flex-col gap-4 border-b border-border-primary px-6 pb-4 pt-4 lg:flex-row lg:items-start">
              <div className="size-29.5 shrink-0 overflow-hidden rounded-lg border border-border-primary bg-bg-secondary">
                <img alt="" className="size-full object-cover" src={activeReview.productImage} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-4">
                  <p className="line-clamp-2 text-sm leading-4 tracking-[-0.28px] text-text-secondary">
                    {activeReview.productName}
                  </p>
                  <span className="w-fit rounded-lg bg-bg-secondary px-2 py-1 text-xs font-medium leading-4 tracking-[-0.24px] text-text-primary">
                    Order ID: {activeReview.orderId}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-8">
                  <p className="flex items-baseline gap-1 text-text-primary">
                    <span className="text-sm leading-4 tracking-[-0.28px]">
                      {activeReview.priceCurrency}
                    </span>
                    <span className="text-xl font-semibold leading-6 tracking-[-0.4px]">
                      {activeReview.priceAmount}
                    </span>
                  </p>
                  <p className="text-sm font-medium leading-4 tracking-[-0.28px] text-text-tertiary">
                    QTY: {activeReview.quantity}
                  </p>
                </div>
              </div>

              <div className="flex w-full shrink-0 flex-col items-stretch gap-2 lg:w-42.25 lg:items-center">
                <button
                  type="button"
                  className="flex h-8.5 cursor-pointer items-center justify-center rounded-full border border-primary-orange px-4 text-sm font-medium leading-4 tracking-[-0.28px] text-primary-orange"
                >
                  Buy again
                </button>
                <p className="text-center text-xs font-medium leading-4 tracking-[-0.24px] text-text-tertiary">
                  Delivered on {activeReview.deliveredOn}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 p-6">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
                  Star Rating:*
                </p>
                <ReviewStarRating value={rating} onChange={setRating} />
              </div>

              <FloatingField
                id="review-title"
                label="Review Title"
                value={title}
                onChange={setTitle}
              />

              <FloatingField
                id="detailed-review"
                label="Detailed Review"
                value={detailedReview}
                onChange={setDetailedReview}
                multiline
              />

              {errorMessage ? (
                <p
                  role="alert"
                  className="rounded-xl bg-orange-light px-4 py-3 text-sm font-medium leading-4.5 tracking-[-0.28px] text-primary-orange"
                >
                  {errorMessage}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isSubmitting}
                className="btn-orange flex h-10 w-fit cursor-pointer items-center justify-center rounded-full px-4 text-base font-medium leading-5 tracking-[-0.32px] text-text-inverse disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Submitting…' : 'Submit your review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  )
}
