import { useMemo } from 'react'
import type { Product } from '../data/products'
import {
  applyListingFilters,
  derivePriceBounds,
  getListingPriceCurrency,
} from '../data/categoryListing'
import { useCatalog } from '../context/CatalogContext'
import { useSearchFacets, useSearchResults } from '../hooks/useProductSearch'
import { useProductDestination } from '../hooks/useProductDestination'
import {
  ListingFiltersSidebar,
  MobileFiltersSheet,
  MobileListingHeader,
  useListingFilters,
} from './ProductListingFilters'
import { ProductCard } from './ProductCard'
import { ListingLoader } from './ListingLoader'
import { PageBreadcrumbs } from './PageBreadcrumbs'

type SearchResultsViewProps = {
  query: string
  onGoHome: () => void
  onProductSelect: (product: Product) => void
  onSeeAllProducts: () => void
}

export function SearchResultsView({
  query,
  onGoHome,
  onProductSelect,
  onSeeAllProducts,
}: SearchResultsViewProps) {
  const { allProducts } = useCatalog()
  const { country } = useProductDestination()
  const { products, isLoading } = useSearchResults(query, allProducts)
  const facets = useSearchFacets(query)
  const {
    activeCategory,
    setActiveCategory,
    draftCategory,
    setDraftCategory,
    isMobileFiltersOpen,
    openMobileFilters,
    closeMobileFilters,
    saveMobileFilters,
    openSections,
    toggleSection,
    filters,
    setFilters,
    draftFilters,
    setDraftFilters,
  } = useListingFilters('All categories')

  // Search results carry the whole catalogue for the query, so the same
  // client-side facet filtering the category listing uses applies here.
  const priceBounds = useMemo(() => derivePriceBounds(products), [products])
  const priceCurrency = useMemo(
    () => getListingPriceCurrency(products, country),
    [country, products],
  )
  const visibleProducts = useMemo(() => applyListingFilters(products, filters), [products, filters])

  // Built as one string because JSX would otherwise introduce stray whitespace
  // around the query between the heading's text nodes.
  const resultCount = visibleProducts.length
  const resultLabel = `${resultCount} result${resultCount === 1 ? '' : 's'} for "${query.trim()}"`

  return (
    <>
      <PageBreadcrumbs
        onGoBack={onGoHome}
        segments={[{ label: 'Home', onClick: onGoHome }, { label: 'Search' }]}
      />

      <MobileListingHeader
        title={`Results for "${query.trim()}"`}
        onOpenFilters={openMobileFilters}
      />

      <MobileFiltersSheet
        isOpen={isMobileFiltersOpen}
        draftCategory={draftCategory}
        categoryOptions={[]}
        onDraftCategoryChange={setDraftCategory}
        openSections={openSections}
        onToggleSection={toggleSection}
        draftFilters={draftFilters}
        onDraftFiltersChange={setDraftFilters}
        facets={facets}
        onClose={closeMobileFilters}
        onSave={saveMobileFilters}
        priceCeiling={priceBounds.ceiling}
        priceCurrency={priceCurrency}
      />

      <section className="border-t border-border-primary px-4 pb-10 pt-4 lg:border-t-0 lg:px-16 lg:pt-8">
        <div className="flex gap-4">
          <ListingFiltersSidebar
            selectedCategory={activeCategory}
            categoryOptions={[]}
            onCategoryChange={setActiveCategory}
            openSections={openSections}
            onToggleSection={toggleSection}
            filters={filters}
            onFiltersChange={setFilters}
            facets={facets}
            priceCeiling={priceBounds.ceiling}
            priceCurrency={priceCurrency}
          />

          <div className="min-w-0 flex-1">
            {isLoading ? (
              <ListingLoader />
            ) : (
              <>
                <h1 className="mb-2 text-xl font-medium leading-6 tracking-[-0.4px] text-text-primary lg:text-2xl lg:leading-8 lg:tracking-[-0.48px]">
                  {resultLabel}
                </h1>
                <p className="mb-6 text-sm text-text-secondary">
                  {visibleProducts.length} of {products.length} products shown
                </p>

                {visibleProducts.length === 0 ? (
                  <div className="flex min-h-48 flex-col items-center justify-center gap-2 py-10 text-center">
                    <p className="text-xl font-medium leading-6 tracking-[-0.4px] text-text-primary">
                      No products found
                    </p>
                    <p className="text-sm font-medium leading-4 tracking-[-0.28px] text-text-secondary">
                      {`We couldn't find anything matching “${query.trim()}”.`}
                    </p>
                    <button
                      type="button"
                      onClick={onSeeAllProducts}
                      className="mt-2 cursor-pointer text-sm font-medium tracking-[-0.28px] text-primary-orange"
                    >
                      See all products
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 items-stretch gap-2 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
                    {visibleProducts.map((product, index) => (
                      <ProductCard
                        key={`${product.id}-${index}`}
                        product={product}
                        to={`/products/${product.id}`}
                        onClick={() => onProductSelect(product)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
