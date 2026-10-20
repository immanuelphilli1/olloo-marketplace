import type { SidebarCategoryId } from './categoriesModal'
import type { CategoryListingSelection } from './categoryListing'

export type CartStep = 'cart' | 'checkout' | 'completed'

/** Landing page for the provider redirect, polled for the real payment state. */
export type PaymentReturnStep = 'payment-return' | 'payment-cancel'

export type HomeNavigationState = {
  categoryListing?: CategoryListingSelection
  cartStep?: CartStep
  wishlistOpen?: boolean
  openCategories?: boolean
  categoriesTargetId?: SidebarCategoryId
  productId?: string
}
