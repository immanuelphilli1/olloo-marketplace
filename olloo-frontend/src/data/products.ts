import type { SidebarCategoryId } from './categoriesModal'

/** One product attribute, ready to display. */
export type ProductAttribute = {
  key: string
  label: string
  value: string
}

export type Product = {
  id: string
  categoryId: SidebarCategoryId | string
  subcategory: string
  image: string
  tag: string
  category: string
  name: string
  price: string
  originalPrice?: string
  discount?: string
  delivery: string
  rating: string
  liked?: boolean
  showAddButton?: boolean
  priceOrange?: boolean
  imageObjectPosition?: string
  /**
   * Numeric facets. The API sends these alongside the display strings above and
   * the listing filters compare against them, so they must survive mapping.
   */
  priceAmount?: number
  /** ISO currency code from `priceMoney`, used by listing price filters. */
  priceCurrency?: string
  brand?: string
  color?: string
  screenSize?: string | null
  /**
   * Every attribute with its display name, in the order the category lists them.
   * Rendered directly as `label: value`; `key` is what attribute filters use.
   */
  attributes?: ProductAttribute[]
  /** False when the default variant cannot currently be bought. */
  inStock?: boolean
}

export function getProductKey(product: Pick<Product, 'id'>): string {
  return product.id
}
