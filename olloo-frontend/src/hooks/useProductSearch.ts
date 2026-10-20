import { useEffect, useMemo, useState } from 'react'
import { catalogApi } from '../api'
import { emptyFacets, mapApiProduct, mapApiProductFacets } from '../api/mappers'
import type { ApiSearchSuggestion } from '../api/types'
import type { ProductFacets } from '../api/types'
import type { Product } from '../data/products'
import { rankProducts } from '../data/searchRelevance'
import { useProductDestination } from './useProductDestination'

/** Debounce for the typeahead so each keystroke does not hit the API. */
const SUGGESTION_DEBOUNCE_MS = 250

export type SearchResults = {
  products: Product[]
  isLoading: boolean
}

/**
 * Product search results for a query, paged to completion by `searchAllProducts`
 * so the list never truncates at the API's 100-item page cap.
 *
 * The API is the source of truth: its hits keep their ranking and always come
 * first. Because the endpoint only matches literally, a query like "shoe" or
 * "snekars" comes back with nothing useful, so the catalog is also ranked
 * locally on synonyms and single-edit typos and any of those hits the API
 * missed are appended below. Results are deduplicated by product id.
 */
export function useSearchResults(
  query: string,
  catalog: Product[] = [],
): SearchResults {
  const [products, setProducts] = useState<Product[]>([])
  // The query that is currently in flight, or null when nothing is loading.
  // Tracking it as state instead of a boolean means no setState call happens
  // synchronously in the effect body.
  const [pendingQuery, setPendingQuery] = useState<string | null>(null)
  const trimmedQuery = query.trim()
  // Search results carry delivery quotes, which the API only returns for a known
  // destination.
  const { country } = useProductDestination()

  useEffect(() => {
    if (!trimmedQuery) return

    let cancelled = false

    async function loadResults() {
      // Set inside the async function rather than in the effect body, which
      // would trigger an extra render pass before the request starts.
      if (!cancelled) {
        setPendingQuery(trimmedQuery)
      }

      try {
        const response = await catalogApi.searchAllProducts({ q: trimmedQuery, country })
        if (!cancelled) {
          setProducts(response.items.map(mapApiProduct))
        }
      } catch {
        // Leave the previous results in place so a failed refetch does not blank
        // the list.
      } finally {
        if (!cancelled) {
          setPendingQuery(null)
        }
      }
    }

    void loadResults()

    return () => {
      cancelled = true
    }
  }, [country, trimmedQuery])

  const widened = useMemo(() => {
    if (catalog.length === 0) {
      return products
    }

    const seen = new Set(products.map((product) => product.id))
    const additions = rankProducts(catalog, trimmedQuery)
      .filter((entry) => !seen.has(entry.product.id))
      .map((entry) => entry.product)

    return additions.length > 0 ? [...products, ...additions] : products
  }, [catalog, products, trimmedQuery])

  // An empty query has no results by definition, so that case is derived here
  // rather than pushed through state.
  if (!trimmedQuery) {
    return { products: [], isLoading: false }
  }

  // Results for a query that is no longer being typed are stale, so a new query
  // shows a loading state rather than the previous query's hits.
  const isLoading = pendingQuery !== null && pendingQuery === trimmedQuery

  return { products: widened, isLoading }
}

/**
 * Typeahead hits for a partial query. Requests are debounced and stale responses
 * are discarded, so fast typing cannot leave an older result list on screen.
 *
 * As with the results, the API leads and the catalog fills the gap: a partial or
 * misspelled term matches nothing on the server, so closely named products are
 * appended as extra suggestions.
 */
export function useSearchSuggestions(query: string, catalog: Product[] = []) {
  const [suggestions, setSuggestions] = useState<ApiSearchSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const trimmedQuery = query.trim()
  // Below two characters the API returns noise, so the minimum is enforced
  // before the request is ever made.
  const isLongEnough = trimmedQuery.length >= 2

  useEffect(() => {
    if (!isLongEnough) return

    let cancelled = false
    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const response = await catalogApi.getSearchSuggestions(trimmedQuery)
        if (!cancelled) {
          setSuggestions(response.suggestions)
        }
      } catch {
        if (!cancelled) {
          setSuggestions([])
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }, SUGGESTION_DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isLongEnough, trimmedQuery])

  const widened = useMemo(() => {
    if (catalog.length === 0) {
      return suggestions
    }

    const seen = new Set(suggestions.map((suggestion) => suggestion.name.toLowerCase()))
    const additions: ApiSearchSuggestion[] = rankProducts(catalog, trimmedQuery)
      .filter((entry) => !seen.has(entry.product.name.toLowerCase()))
      .map((entry) => ({
        rid: entry.product.id,
        name: entry.product.name,
        image: entry.product.image,
      }))

    return additions.length > 0 ? [...suggestions, ...additions] : suggestions
  }, [catalog, suggestions, trimmedQuery])

  if (!isLongEnough) {
    return { suggestions: [], isLoading: false }
  }

  return { suggestions: widened, isLoading }
}

/** Search facets drive the same filter panel the category listing uses. */
export function useSearchFacets(query: string): ProductFacets {
  const [facets, setFacets] = useState<ProductFacets>(emptyFacets)
  // Search facets include delivery, which the API only computes for a known
  // destination, so the query carries one.
  const { country } = useProductDestination()

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) return

    let cancelled = false

    async function loadFacets() {
      try {
        const response = await catalogApi.searchAllProducts({ q: trimmed, country })
        if (!cancelled && response.facets) {
          setFacets(mapApiProductFacets(response.facets))
        }
      } catch {
        // Keep the previous facets rather than clearing the filter options.
      }
    }

    void loadFacets()

    return () => {
      cancelled = true
    }
  }, [country, query])

  return facets
}
