import { apiRequest } from '../client'
import type { CartResponse } from '../types'

export async function getCart(): Promise<CartResponse> {
  return apiRequest<CartResponse>('/cart')
}

export async function addCartItem(productId: string, quantity = 1, variantId?: string): Promise<CartResponse> {
  return apiRequest<CartResponse>('/cart/items', {
    method: 'POST',
    body: { productId, quantity, ...(variantId ? { variantId } : {}) },
  })
}

export async function updateCartItem(
  cartItemRid: string,
  patch: { quantity?: number; selected?: boolean },
): Promise<CartResponse> {
  return apiRequest<CartResponse>(`/cart/items/${cartItemRid}`, {
    method: 'PATCH',
    body: patch,
  })
}

export async function removeCartItem(cartItemRid: string): Promise<CartResponse> {
  return apiRequest<CartResponse>(`/cart/items/${cartItemRid}`, { method: 'DELETE' })
}

export async function removeSelectedCartItems(): Promise<CartResponse> {
  return apiRequest<CartResponse>('/cart/items', { method: 'DELETE' })
}

export async function selectAllCartItems(selected: boolean): Promise<CartResponse> {
  return apiRequest<CartResponse>('/cart/items/select-all', {
    method: 'PATCH',
    body: { selected },
  })
}

export async function moveSelectedToWishlist(): Promise<CartResponse> {
  return apiRequest<CartResponse>('/cart/items/move-to-wishlist', {
    method: 'POST',
    body: {},
  })
}

/**
 * Folds the guest cart into the signed-in user's cart. This is one of the two
 * endpoints that still reads the guest `X-Cart-Id` alongside the Bearer token —
 * the whole point is to hand the server the guest cart to merge.
 */
export async function mergeCart(): Promise<CartResponse> {
  return apiRequest<CartResponse>('/cart/merge', {
    method: 'POST',
    body: {},
    guestCartId: true,
  })
}
