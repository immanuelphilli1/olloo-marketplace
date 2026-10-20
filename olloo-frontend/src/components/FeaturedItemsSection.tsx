import type { Product } from '../data/products'
import { getProductPath } from '../data/shopRoutes'
import { useCatalog } from '../context/CatalogContext'
import { ProductCard } from './ProductCard'

type FeaturedItemsSectionProps = {
  onProductSelect?: (product: Product) => void
}

export function FeaturedItemsSection({ onProductSelect }: FeaturedItemsSectionProps) {
  const { featuredProducts, isReady } = useCatalog()

  return (
    <section className="border-b border-border-primary px-4 lg:px-16">
      <div className="flex flex-col gap-4 pt-6 pb-4 lg:py-6">
        <h2 className="text-base font-medium leading-6 tracking-[-0.32px] text-text-primary lg:text-2xl lg:leading-10 lg:tracking-[-0.64px]">
          Featured items
        </h2>
        {isReady && featuredProducts.length > 0 ? (
        <div className="grid grid-cols-2 items-stretch gap-2 lg:grid-cols-5">
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
