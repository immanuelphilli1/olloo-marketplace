import type { CategoryListingSelection } from './categoryListing'

export type ProductReview = {
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
  shippingAddress: {
    line1: string
    line2: string
  }
  shippingFee: string
  deliveryEstimate: string
  itemsTotal: string
  subtotal: string
}

export type ProductDetailContext = {
  detail: ProductDetail
  selection: CategoryListingSelection
}
