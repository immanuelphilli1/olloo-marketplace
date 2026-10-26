import type { CategoryListingSelection } from './categoryListing'

export type ProductReview = {
  rid?: string
  title?: string
  /** Only set on the shopper's own review: `pending` until staff approve it. */
  status?: 'pending' | 'published'
  author: string
  location: string
  date: string
  rating: number
  text: string
}

export type ProductDetailGalleryImage = {
  rid: string | null
  imageUrl: string
  variantRid: string | null
}

export type ProductOptionGroup = {
  key: string
  label: string
  values: string[]
}

export type ProductDetailVariant = {
  rid: string
  name: string
  color: string | null
  size: string | null
  isDefault: boolean
  inStock: boolean
  stockQuantity: number | null
  priceAmount: string
  priceCurrency: string
  imageIndex: number | null
  delivery: string
}

/** One option in a product family, ready to display. */
export type ProductFamilyOption = {
  rid: string
  value: string
  /** Formatted price, e.g. `GHS 2,093.42`. */
  price: string
  inStock: boolean
  isCurrent: boolean
}

export type ProductFamily = {
  optionName: string
  options: ProductFamilyOption[]
}

export type ProductDetail = {
  product: import('./products').Product
  images: string[]
  gallery: ProductDetailGalleryImage[]
  optionGroups: ProductOptionGroup[]
  variants: ProductDetailVariant[]
  ratingValue: number
  reviewCount: number
  soldCount: number
  priceAmount: string
  priceCurrency: string
  /** @deprecated Legacy chip list when `optionGroups` is empty. */
  modelOptions: string[]
  descriptionLines: string[]
  reviews: ProductReview[]
  /**
   * Delivery fee to the shopper's destination, formatted. Empty when the API
   * had no destination to quote (guests, or no default address).
   */
  shippingFee: string
  /** The same fee as money, so the page can add it to the item price. */
  deliveryFeeMoney: { amount: number; currency: string } | null
  deliveryEstimate: string
  /** Other sizes of the same model, each its own product; null when it stands alone. */
  family: ProductFamily | null
  itemsTotal: string
  subtotal: string
}

export type ProductDetailContext = {
  detail: ProductDetail
  selection: CategoryListingSelection
}
