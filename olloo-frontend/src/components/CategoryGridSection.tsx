import { useMemo } from 'react'
import { resolveAssetUrl } from '../api/mappers'
import { useCatalog } from '../context/CatalogContext'
import { getCategoryNodeId } from '../data/catalogCategories'
import type { SidebarCategoryId } from '../data/categoriesModal'

type CategoryGridCard = {
  id: string
  imageUrl: string | null
  title: string
  productCount: number
}

function formatProductBadge(count: number): string {
  if (count === 1) {
    return '1 Product'
  }

  return `${count} Products`
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

function productImageForCategory(
  items: Array<{ categoryId?: string; image?: string }>,
  categoryId: string,
  categoryImageUrl: string | null,
): string | null {
  const match = productsInCategory(items, categoryId).find((item) => item.image)
  if (match?.image) return match.image
  return categoryImageUrl
}

function CategoryCardItem({
  id,
  imageUrl,
  badge,
  title,
  onOpenCategories,
  className = '',
}: CategoryGridCard & {
  badge: string
  onOpenCategories: (categoryId: SidebarCategoryId | string, label: string) => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenCategories(id, title)}
      aria-label={`Browse ${title}`}
      className={`relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-lg border border-border-primary bg-bg-secondary text-left ${className}`}
    >
      {imageUrl ? (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <img alt="" className="absolute size-full object-cover" src={imageUrl} />
          <div className="absolute inset-0 bg-[rgba(0,6,7,0.2)]" />
        </div>
      ) : null}
      <div className="relative p-4">
        <span className="hidden rounded-full bg-glass px-2 py-1 text-xs font-medium tracking-[-0.24px] text-text-inverse">
          {badge}
        </span>
      </div>
      <div className="relative p-4">
        <h3 className="text-sm font-medium tracking-[-0.28px] text-text-inverse">{title}</h3>
      </div>
    </button>
  )
}

export function CategoryGridSection({
  onOpenCategories,
}: {
  onOpenCategories: (categoryId: SidebarCategoryId | string, label?: string) => void
}) {
  const { categories: apiCategories, allProducts, isReady } = useCatalog()

  const categories = useMemo((): CategoryGridCard[] => {
    if (!isReady) {
      return []
    }

    return apiCategories.map((category) => {
      const id = getCategoryNodeId(category)
      const categoryImageUrl =
        resolveAssetUrl(category.imageUrl ?? category.image ?? undefined) || null
      const imageUrl = productImageForCategory(allProducts, id, categoryImageUrl)
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
    <section className="px-4 lg:px-16">
      <h2 className="text-base pt-6 lg:pt-0 font-medium leading-6 tracking-[-0.32px] text-text-primary lg:text-2xl lg:leading-10 lg:tracking-[-0.64px]">
        Shop by Category
      </h2>
      <div className="py-4 lg:py-6">
        <div className="flex gap-2 overflow-x-auto scroll-smooth [-ms-overflow-style:none] scrollbar-none lg:grid lg:grid-cols-6 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
          {categories.map((category) => (
            <div key={category.id} className="shrink-0 lg:min-w-0 lg:shrink">
              <CategoryCardItem
                {...category}
                badge={formatProductBadge(category.productCount)}
                onOpenCategories={onOpenCategories}
                className="size-40 lg:aspect-square lg:size-auto lg:w-full"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
