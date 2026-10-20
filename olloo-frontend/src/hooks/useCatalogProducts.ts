import { useEffect, useState } from 'react'
import { catalogApi } from '../api'
import { mapApiProduct } from '../api/mappers'
import type { ProductListParams } from '../api/services/catalog'
import type { Product } from '../data/products'

/** Params for a listing fetch. Page and limit are owned by the fetch itself. */
export type ProductListingQuery = Omit<ProductListParams, 'page' | 'limit'>

export function useProductListing(
  params: ProductListingQuery,
  initialProducts: Product[],
  enabled = true,
) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [isLoading, setIsLoading] = useState(true)
  const paramsKey = JSON.stringify(params)

  useEffect(() => {
    if (!enabled) {
      setIsLoading(true)
      return
    }

    let cancelled = false
    const requestParams = JSON.parse(paramsKey) as ProductListingQuery

    async function loadProducts() {
      setIsLoading(true)
      try {
        // Paginates to completion so the listing always shows every matching
        // product rather than one arbitrary page.
        const response = await catalogApi.listAllProducts(requestParams)
        if (!cancelled) {
          setProducts(response.items.map(mapApiProduct))
        }
      } catch {
        // Keep showing the previous list when a refetch fails.
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
  }, [enabled, paramsKey])

  return { products, isLoading }
}

export function useRecommendations(context: string | undefined) {
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadProducts() {
      try {
        const response = await catalogApi.getRecommendations(context)
        if (!cancelled) {
          setProducts(response.items.map(mapApiProduct))
        }
      } catch {
        if (!cancelled) {
          setProducts([])
        }
      }
    }

    void loadProducts()

    return () => {
      cancelled = true
    }
  }, [context])

  return products
}
