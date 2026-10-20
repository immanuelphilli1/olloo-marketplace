import { ApiError } from '../api/client'

/**
 * Explains why a review could not be submitted.
 *
 * Reviews are moderated, so submitting no longer publishes immediately. The two
 * documented rejections are both about the order line rather than the review
 * itself: a `404` means the line has already left the waiting list (so the
 * shopper has reviewed it, or it is no longer eligible), and `409
 * review_exists` means two submits raced and one won.
 */
export function getReviewErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return 'This item is no longer awaiting a review.'
    }
    if (error.code === 'review_exists') {
      return 'You have already reviewed this item.'
    }
    if (error.message) return error.message
  }

  return 'We could not submit your review. Please try again.'
}