import type { Product } from '../data/products'
import { getProductPath } from '../data/shopRoutes'
import { useCatalog } from '../context/CatalogContext'
import { ProductCard } from './ProductCard'
import { SectionHeading } from './SectionHeading'

type FeaturedItemsSectionProps = {
  onProductSelect?: (product: Product) => void
}

export function FeaturedItemsSection({ onProductSelect }: FeaturedItemsSectionProps) {
  const { featuredProducts, isReady } = useCatalog()

  return (
    <section className="px-4 lg:px-16">
      <div className="flex flex-col gap-4 lg:gap-5">
        <SectionHeading title="Featured for you" subtitle="Hand picked by the olloo team" />
        {isReady && featuredProducts.length > 0 ? (
        <div className="grid grid-cols-2 items-stretch gap-2.5 sm:grid-cols-3 lg:grid-cols-4 lg:gap-3 xl:grid-cols-6">
          {featuredProducts.map((product, index) => (
            <ProductCard
              key={`${product.id}-${index}`}
              product={product}
              enableAddButton
              to={getProductPath(product.id, { from: 'featured' })}
              onClick={onProductSelect ? () => onProductSelect(product) : undefined}
            />
          ))}
        </div>
        ) : null}
      </div>
    </section>
  )
}
