import type { ApiCategory } from '../api/types'
import type { SidebarCategoryId } from './categoriesModal'
import type { CategoryListingSelection } from './categoryListing'
import {
  ALL_PRODUCTS_LABEL,
  buildAllCategoriesListingSelection,
  buildCategoryListingSelection,
  findCategoryInTree,
  findSubcategorySlugByLabel,
  getCategoryNodeId,
  getSubcategoryOptions,
  isSpecialCategoryId,
} from './catalogCategories'

export type ProductLinkContext =
  | { from: 'home' | 'featured' | 'wishlist' | 'order-complete' }
  | { categorySlug: string }
  | { categoryId: SidebarCategoryId | string; subcategory?: string }

export function getHomePath(): string {
  return '/'
}

export function getCartPath(): string {
  return '/cart'
}

export function getCheckoutPath(): string {
  return '/checkout'
}

export function getOrderCompletePath(): string {
  return '/order-complete'
}

export function getPaymentReturnPath(): string {
  return '/checkout/return'
}

export function getPaymentCancelPath(): string {
  return '/checkout/cancel'
}

export function getGoogleOAuthCallbackPath(): string {
  return '/oauth/google/callback'
}

export function getWishlistPath(): string {
  return '/wishlist'
}

export function getSearchPath(query: string): string {
  const trimmed = query.trim()
  return trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search'
}

export function getSearchQuery(searchParams: URLSearchParams): string {
  return searchParams.get('q') ?? ''
}

export function getCategoryPath(
  categoryId: SidebarCategoryId | string,
  subcategoryLabel?: string,
  apiCategories: ApiCategory[] = [],
): string {
  if (categoryId === 'all-categories') {
    return '/categories'
  }

  if (
    subcategoryLabel &&
    subcategoryLabel !== ALL_PRODUCTS_LABEL &&
    !isSpecialCategoryId(categoryId)
  ) {
    const slug = findSubcategorySlugByLabel(categoryId, subcategoryLabel, apiCategories)
    if (slug) {
      return `/categories/${slug}`
    }
  }

  return `/categories/${categoryId}`
}

export function getCategoryPathFromSelection(
  selection: CategoryListingSelection,
  apiCategories: ApiCategory[] = [],
): string {
  return getCategoryPath(selection.categoryId, selection.subcategoryLabel, apiCategories)
}

export function getProductPathForListingSelection(
  productId: string,
  selection: CategoryListingSelection,
  apiCategories: ApiCategory[] = [],
): string {
  if (selection.subcategoryLabel === ALL_PRODUCTS_LABEL) {
    return getProductPath(productId, { categoryId: selection.categoryId })
  }

  const slug = findSubcategorySlugByLabel(
    selection.categoryId,
    selection.subcategoryLabel,
    apiCategories,
  )
  if (slug) {
    return getProductPath(productId, { categorySlug: slug })
  }

  return getProductPath(productId, {
    categoryId: selection.categoryId,
    subcategory: selection.subcategoryLabel,
  })
}

export function getProductPath(productId: string, context?: ProductLinkContext): string {
  const base = `/products/${productId}`

  if (!context) {
    return base
  }

  if ('from' in context) {
    return `${base}?from=${context.from}`
  }

  if ('categorySlug' in context) {
    const params = new URLSearchParams({ category: context.categorySlug })
    return `${base}?${params.toString()}`
  }

  const params = new URLSearchParams({ category: context.categoryId })
  if (context.subcategory) {
    params.set('subcategory', context.subcategory)
  }

  return `${base}?${params.toString()}`
}

export function parseCategoryRoute(
  categoryIdParam: string | undefined,
  subcategoryParam: string | null,
  apiCategories: ApiCategory[] = [],
): CategoryListingSelection | null {
  if (!categoryIdParam) {
    return buildAllCategoriesListingSelection(apiCategories)
  }

  if (categoryIdParam === 'all-categories') {
    return buildAllCategoriesListingSelection(apiCategories)
  }

  if (isSpecialCategoryId(categoryIdParam)) {
    return buildCategoryListingSelection(
      categoryIdParam as SidebarCategoryId,
      apiCategories,
      subcategoryParam,
    )
  }

  if (apiCategories.length > 0) {
    const match = findCategoryInTree(apiCategories, categoryIdParam)
    if (match) {
      const rootId = getCategoryNodeId(match.root)
      const nodeId = getCategoryNodeId(match.node)
      const subcategoryOptions = getSubcategoryOptions(rootId, apiCategories)

      if (rootId !== nodeId) {
        return {
          categoryId: rootId,
          categoryLabel: match.root.label,
          subcategoryLabel: match.node.label,
          subcategoryOptions,
        }
      }

      return buildCategoryListingSelection(categoryIdParam, apiCategories, subcategoryParam)
    }

    const isTopLevel = apiCategories.some(
      (category) => getCategoryNodeId(category) === categoryIdParam,
    )
    if (!isTopLevel) {
      return null
    }
  }

  return buildCategoryListingSelection(
    categoryIdParam as SidebarCategoryId,
    apiCategories,
    subcategoryParam,
  )
}
