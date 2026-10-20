import type { ApiCategory } from '../api/types'
import { buildAllCategoriesListingSelection } from './catalogCategories'
import type { SidebarCategoryId } from './categoriesModal'
import { getCheckoutCurrency } from './checkoutPaymentMethods'
import type { Product } from './products'

export type CategoryListingSelection = {
  categoryId: SidebarCategoryId | string
  categoryLabel: string
  subcategoryLabel: string
  subcategoryOptions: string[]
}

export function getAllCategoriesListingSelection(
  apiCategories: ApiCategory[] = [],
): CategoryListingSelection {
  return buildAllCategoriesListingSelection(apiCategories)
}

export const collapsedFilterSections = ['Brand', 'Color', 'Seller']

export const mobileCollapsedFilterSections = ['Color', 'Connectivity', 'Storage']

export type ListingFilters = {
  minPrice: number
  /** `null` means no upper limit (shopper has not set a max). */
  maxPrice: number | null
  rating: string
  delivery: string
  brand: string
  color: string
  screenSize: string
}

export const PRICE_FLOOR = 0

export const defaultListingFilters: ListingFilters = {
  minPrice: PRICE_FLOOR,
  maxPrice: null,
  rating: 'all',
  delivery: '',
  brand: '',
  color: '',
  screenSize: '',
}

/** Rounds up so the slider ceiling covers the most expensive product in the list. */
export function roundPriceCeiling(value: number): number {
  if (value <= 0) {
    return 100
  }

  if (value <= 1000) {
    return Math.ceil(value / 100) * 100
  }

  return Math.ceil(value / 1000) * 1000
}

/**
 * Currency label for the price filter. Prefer the catalog's own `priceMoney`
 * currency when products are loaded; otherwise fall back to the destination
 * country's billing currency (same mapping checkout uses).
 */
export function getListingPriceCurrency(
  products: readonly Product[],
  countryCode?: string,
): string {
  for (const product of products) {
    const currency = product.priceCurrency?.trim()
    if (currency) {
      return currency
    }
  }

  return getCheckoutCurrency(countryCode)
}

export function derivePriceBounds(products: Product[]): { floor: number; ceiling: number } {
  let highest = 0

  for (const product of products) {
    if (product.priceAmount !== undefined && product.priceAmount > highest) {
      highest = product.priceAmount
    }
  }

  return {
    floor: PRICE_FLOOR,
    ceiling: roundPriceCeiling(highest),
  }
}

export function isPriceFilterActive(filters: ListingFilters): boolean {
  return filters.minPrice > PRICE_FLOOR || filters.maxPrice !== null
}

export function hasActiveFilters(filters: ListingFilters): boolean {
  return (
    isPriceFilterActive(filters) ||
    filters.rating !== defaultListingFilters.rating ||
    filters.delivery !== '' ||
    filters.brand !== '' ||
    filters.color !== '' ||
    filters.screenSize !== ''
  )
}

function matchesRating(product: Product, rating: string): boolean {
  if (rating === 'all' || rating === '') {
    return true
  }

  return Number(product.rating || 0) >= Number(rating)
}

function matchesPrice(product: Product, minPrice: number, maxPrice: number | null): boolean {
  if (product.priceAmount === undefined) {
    return true
  }

  if (product.priceAmount < minPrice) {
    return false
  }

  if (maxPrice === null) {
    return true
  }

  return product.priceAmount <= maxPrice
}

export function applyListingFilters(
  products: Product[],
  filters: ListingFilters,
): Product[] {
  return products.filter((product) => {
    if (!matchesRating(product, filters.rating)) {
      return false
    }

    if (!matchesPrice(product, filters.minPrice, filters.maxPrice)) {
      return false
    }

    if (filters.delivery && product.delivery !== filters.delivery) {
      return false
    }

    if (filters.brand && product.brand !== filters.brand) {
      return false
    }

    if (filters.color && product.color !== filters.color) {
      return false
    }

    if (filters.screenSize && product.screenSize !== filters.screenSize) {
      return false
    }

    return true
  })
}
