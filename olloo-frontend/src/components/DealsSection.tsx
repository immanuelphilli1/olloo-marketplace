import { useMemo } from 'react'
import FireFillIcon from 'remixicon-react/FireFillIcon'
import { useCatalog } from '../context/CatalogContext'
import type { Product } from '../data/products'
import { getProductPath } from '../data/shopRoutes'
import { ProductCard } from './ProductCard'
import { SectionHeading } from './SectionHeading'

const DEAL_COUNT = 12

type DealsSectionProps = {
  onProductSelect?: (product: Product) => void
  onShopAll: () => void
}

/**
 * The deepest live discounts, ranked by percentage off.
 *
 * Deliberately no countdown: there is no sale end date in the API, and a timer
 * that resets on reload is a dark pattern shoppers learn to distrust.
 */
export function DealsSection({ onProductSelect, onShopAll }: DealsSectionProps) {
  const { allProducts, isReady } = useCatalog()

  const deals = useMemo(
    () =>
      allProducts
        .filter((product) => product.discountPercent && product.inStock !== false)
        .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0))
        .slice(0, DEAL_COUNT),
    [allProducts],
  )

  if (!isReady || deals.length === 0) return null

  const topDiscount = deals[0]?.discountPercent

  return (
    <section className="px-4 lg:px-16">
      <div className="flex flex-col gap-4 rounded-card bg-gradient-to-br from-accent-light via-[#fffaf0] to-red-light p-3 pt-4 lg:gap-5 lg:p-6">
        <SectionHeading
          title="Top deals"
          subtitle={topDiscount ? `Save up to ${topDiscount}% on popular picks` : undefined}
          icon={
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-red text-text-inverse lg:size-11">
              <FireFillIcon className="size-5 lg:size-6" aria-hidden />
            </span>
          }
          action={{ label: 'See all', onClick: onShopAll }}
        />
        <div className="-mx-3 flex gap-2.5 overflow-x-auto px-3 pb-1 scrollbar-none snap-x lg:mx-0 lg:grid lg:grid-cols-6 lg:gap-3 lg:overflow-visible lg:px-0 lg:pb-0">
          {deals.map((product) => (
            <div key={product.id} className="w-[42vw] max-w-48 shrink-0 snap-start lg:w-auto lg:max-w-none">
              <ProductCard
                product={product}
                enableAddButton
                to={getProductPath(product.id, { from: 'home' })}
                onClick={onProductSelect ? () => onProductSelect(product) : undefined}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
