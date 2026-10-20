import { useEffect, useState } from 'react'
import { catalogApi } from '../api'
import { mapApiProduct } from '../api/mappers'
import type { Product } from '../data/products'

/**
 * Subcategories under "New Releases" that are backed by a real data source.
 *
 * "Latest Arrivals" maps to GET /products/new-arrivals, which already powers the
 * homepage New Arrivals carousel. The remaining labels ("Just Dropped",
 * "Fresh Picks", "Coming Soon", "Limited Edition") have no backend equivalent:
 * the product payload has no date field of any kind (no createdAt / addedAt /
 * publishedAt) and no endpoint filters by date, so "added within the week" and
 * "random per day" cannot be computed from real data yet. They are deliberately
 * left unmapped rather than faked - see docs/NOT-INTEGRATED.md.
 */
export const NEW_RELEASES_SUBATEGORY = 'Latest Arrivals'

export function isNewReleasesSubcategory(subcategoryLabel: string): boolean {
  return subcategoryLabel === NEW_RELEASES_SUBATEGORY
}

export function useNewReleasesSubcategoryProducts(enabled: boolean) {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    setIsLoading(true)

    async function loadProducts() {
      try {
        const response = await catalogApi.getNewArrivals({ limit: 100 })
        if (!cancelled) {
          setProducts(response.items.map(mapApiProduct))
        }
      } catch {
        if (!cancelled) {
          setProducts([])
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadProducts()

    return () => {
      cancelled = true
    }
  }, [enabled])

  return { products, isLoading }
}
