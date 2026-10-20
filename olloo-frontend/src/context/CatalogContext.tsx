import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { catalogApi } from '../api'
import { emptyFacets, mapApiProduct, mapApiProductFacets } from '../api/mappers'
import type { ApiCategory, ProductFacets } from '../api/types'
import type { Product } from '../data/products'
import { useProductDestination } from '../hooks/useProductDestination'

type CatalogContextValue = {
  categories: ApiCategory[]
  featuredProducts: Product[]
  newArrivalProducts: Product[]
  /**
   * The whole catalog, paged to completion. The listing page needs the complete
   * set because filters are applied client-side, and because the API's default
   * page size would otherwise truncate the result.
   */
  allProducts: Product[]
  /** Live facet values (brands, colors, delivery, screen sizes) from the API. */
  facets: ProductFacets
  isReady: boolean
}

const CatalogContext = createContext<CatalogContextValue | null>(null)

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<ApiCategory[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [newArrivalProducts, setNewArrivalProducts] = useState<Product[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [facets, setFacets] = useState<ProductFacets>(emptyFacets)
  const [isReady, setIsReady] = useState(false)

  // Delivery quotes and tax are only returned for a known destination, so every
  // catalog read carries one. This changes when the customer's default address
  // is resolved, which re-runs the load below. Only the `country` is sent; the
  // hook's `isLoading` flag would otherwise leak in as an unknown query param.
  const { country, isLoading: isDestinationLoading } = useProductDestination()
  const destination = useMemo(() => ({ country }), [country])

  useEffect(() => {
    let cancelled = false

    async function loadCatalog() {
      try {
        const [categoriesResponse, newArrivalsResponse, featuredResponse, allResponse] =
          await Promise.all([
            catalogApi.getCategories(),
            catalogApi.getNewArrivals({ limit: 100, ...destination }),
            catalogApi.getFeaturedProducts(destination),
            catalogApi.listAllProducts(destination),
          ])

        if (cancelled) {
          return
        }

        setCategories(categoriesResponse.categories)
        setNewArrivalProducts(newArrivalsResponse.items.map(mapApiProduct))
        setFeaturedProducts(featuredResponse.items.map(mapApiProduct))
        setAllProducts(allResponse.items.map(mapApiProduct))
        setFacets(mapApiProductFacets(allResponse.facets))
      } catch {
        if (!cancelled) {
          setCategories([])
          setNewArrivalProducts([])
          setFeaturedProducts([])
          setAllProducts([])
          setFacets(emptyFacets)
        }
      } finally {
        if (!cancelled) {
          setIsReady(true)
        }
      }
    }

    void loadCatalog()

    return () => {
      cancelled = true
    }
    // `isDestinationLoading` is a dependency so the catalog is not reported ready
    // while the customer's real destination is still being resolved; the first
    // load uses the default country and is superseded once the address is known.
  }, [destination, isDestinationLoading])

  const value = useMemo(
    () => ({
      categories,
      featuredProducts,
      newArrivalProducts,
      allProducts,
      facets,
      isReady,
    }),
    [allProducts, categories, facets, featuredProducts, isReady, newArrivalProducts],
  )

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog() {
  const context = useContext(CatalogContext)
  if (!context) {
    throw new Error('useCatalog must be used within CatalogProvider')
  }
  return context
}
