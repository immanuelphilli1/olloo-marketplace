import { apiRequest } from '../client'
import type { PaginatedProductsResponse } from '../types'

export async function getWishlist(params: {
  category?: string
  minRating?: number
} = {}): Promise<PaginatedProductsResponse> {
  return apiRequest<PaginatedProductsResponse>('/wishlist', { searchParams: params })
}

/** A category present in the wishlist, as returned for the category filter. */
export type WishlistCategory = {
  rid: string
  /** The value to pass as `?category=` to `GET /wishlist`. */
  slug: string
  label: string
}

/**
 * Categories present in the wishlist, for the filter control.
 *
 * Rows are objects, not strings: filter on `slug`, which is what the listing
 * endpoint's `category` parameter accepts.
 */
export async function getWishlistCategories(): Promise<WishlistCategory[]> {
  const response = await apiRequest<{ categories?: WishlistCategory[] }>(
    '/wishlist/categories',
  )
  return response.categories ?? []
}

export async function addToWishlist(productRid: string): Promise<void> {
  await apiRequest<void>(`/wishlist/${productRid}`, { method: 'POST' })
}

export async function removeFromWishlist(productRid: string): Promise<void> {
  await apiRequest<void>(`/wishlist/${productRid}`, { method: 'DELETE' })
}
