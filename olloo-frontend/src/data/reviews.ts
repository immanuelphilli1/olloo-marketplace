export type ReviewFilter = 'waiting' | 'reviewed'

export type WaitingReviewRecord = {
  id: string
  productName: string
  productImage: string
  orderId: string
  deliveredOn: string
  priceCurrency: string
  priceAmount: string
  quantity: number
}

/**
 * A review the shopper has already submitted. It is a waiting record plus
 * everything the shopper wrote and the moderation state, which the waiting list
 * has no reason to carry.
 */
export type ReviewedReviewRecord = WaitingReviewRecord & {
  /** ISO timestamp the review was submitted, formatted for display. */
  submittedOn: string
  /** `pending` until staff approve it, then `published`. */
  status: 'pending' | 'published'
  rating: number | null
  title: string
  text: string
}

/**
 * The request body for `POST /reviews`. Kept separate from what comes back,
 * because only the response carries the moderation state.
 */
export type ReviewSubmission = {
  reviewId: string
  rating: number
  title: string
  detailedReview: string
}

/**
 * What the shopper just submitted. `POST /reviews` creates the review as
 * `pending`, so a freshly submitted row lands in the Reviewed tab carrying the
 * server's own moderation state rather than an assumed one.
 */
export type SubmittedReview = ReviewSubmission & {
  status: 'pending' | 'published'
}

export const reviewFilterTabs: { id: ReviewFilter; label: string }[] = [
  { id: 'waiting', label: 'Waiting for review' },
  { id: 'reviewed', label: 'Reviewed' },
]

/**
 * No seed rows: the reviews API is the only source of truth, so an account with
 * nothing to review shows the empty state rather than placeholder products.
 */
export const waitingReviews: WaitingReviewRecord[] = []

export const reviewedReviews: ReviewedReviewRecord[] = []

export const WAITING_REVIEWS_PAGE_SIZE = 3
export const REVIEWED_REVIEWS_PAGE_SIZE = 4

export function filterReviews(
  activeFilter: ReviewFilter,
  waitingItems: WaitingReviewRecord[],
  reviewedItems: ReviewedReviewRecord[],
): WaitingReviewRecord[] | ReviewedReviewRecord[] {
  switch (activeFilter) {
    case 'waiting':
      return waitingItems
    case 'reviewed':
      return reviewedItems
    default: {
      const exhaustiveCheck: never = activeFilter
      return exhaustiveCheck
    }
  }
}

export function getReviewsEmptyStateMessage(): string {
  return "You don't have any reviews"
}
