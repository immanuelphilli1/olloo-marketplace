import { createElement, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { resolveAssetUrl } from '../api/mappers'
import { useCatalog } from '../context/CatalogContext'
import { getCategoryNodeId } from '../data/catalogCategories'
import { getCategoryNavIcon } from '../data/categoryNavIcons'
import { getCategoryPath } from '../data/shopRoutes'
import { SectionHeading } from './SectionHeading'

type CategoryGridCard = {
  id: string
  imageUrl: string | null
  title: string
  productCount: number
}

function formatProductBadge(count: number): string {
  if (count === 1) {
    return '1 product'
  }

  return `${count} products`
}

function productsInCategory(
  items: Array<{ categoryId?: string; image?: string }>,
  categoryId: string,
) {
  return items.filter((item) => {
    const id = item.categoryId
    if (!id) return false
    return id === categoryId || id.startsWith(`${categoryId}-`)
  })
}

function countProductsForCategory(
  items: Array<{ categoryId?: string }>,
  categoryId: string,
): number {
  return productsInCategory(items, categoryId).length
}

function CategoryCardItem({
  id,
  imageUrl,
  title,
}: CategoryGridCard & { badge: string }) {
  return (
    <Link
      to={getCategoryPath(id)}
      onClick={() => window.scrollTo({ top: 0 })}
      // `relative` keeps the visually hidden caption (sr-only is absolutely
      // positioned) inside the tile; without it the caption escaped the
      // scrolling row and widened the whole page on phones.
      className="group relative flex w-21 cursor-pointer flex-col items-center gap-2 text-center lg:w-full"
    >
      <span className="relative block aspect-square w-full overflow-hidden rounded-full bg-bg-secondary ring-2 ring-transparent ring-offset-2 transition-[box-shadow] duration-300 group-hover:ring-brand">
        {imageUrl ? (
          <img
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-110"
            src={imageUrl}
          />
        ) : (
          // No category image yet: the category's own name fills the tile.
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-brand-light to-accent-light p-2 text-brand">
            {/* The icon is looked up from a fixed map, not created per render. */}
            {createElement(getCategoryNavIcon(id), {
              className: 'size-5 shrink-0 lg:size-7',
              'aria-hidden': true,
            })}
            <span className="line-clamp-2 font-display text-[11px] font-bold leading-tight text-text-primary lg:text-sm">
              {title}
            </span>
          </span>
        )}
      </span>
      <span className={imageUrl ? 'flex flex-col' : 'sr-only'}>
        <span className="line-clamp-2 text-xs font-semibold leading-tight text-text-primary group-hover:text-brand lg:text-sm">
          {title}
        </span>
        {/* <span className="mt-0.5 hidden text-xs text-text-tertiary lg:block">{badge}</span> */}
      </span>
    </Link>
  )
}

export function CategoryGridSection({ onShopAll }: { onShopAll: () => void }) {
  const { categories: apiCategories, allProducts, isReady } = useCatalog()

  const categories = useMemo((): CategoryGridCard[] => {
    if (!isReady) {
      return []
    }

    return apiCategories.map((category) => {
      const id = getCategoryNodeId(category)
      // The category's own image only. Borrowing a product photo made a
      // department look like whichever item happened to load first.
      const imageUrl = resolveAssetUrl(category.imageUrl ?? category.image ?? undefined) || null
      return {
        id,
        imageUrl,
        title: category.label,
        productCount: countProductsForCategory(allProducts, id),
      }
    })
  }, [allProducts, apiCategories, isReady])

  if (isReady && categories.length === 0) {
    return null
  }

  return (
    <section className="flex flex-col gap-4 px-4 lg:gap-6 lg:px-16">
      <SectionHeading
        title="Shop by category"
        action={{ label: 'See all', onClick: onShopAll }}
      />
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 scrollbar-none lg:mx-0 lg:grid lg:grid-cols-8 lg:gap-6 lg:overflow-visible lg:px-0">
        {categories.map((category) => (
          <div key={category.id} className="shrink-0 lg:min-w-0">
            <CategoryCardItem
              {...category}
              badge={formatProductBadge(category.productCount)}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
