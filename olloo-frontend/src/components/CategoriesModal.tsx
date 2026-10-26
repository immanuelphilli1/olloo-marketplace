import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppsLineIcon from 'remixicon-react/AppsLineIcon'
import ArrowRightLineIcon from 'remixicon-react/ArrowRightLineIcon'
import ArrowRightSLineIcon from 'remixicon-react/ArrowRightSLineIcon'
import FireFillIcon from 'remixicon-react/FireFillIcon'
import StarFillIcon from 'remixicon-react/StarFillIcon'
import { useCatalog } from '../context/CatalogContext'
import {
  buildCatalogSidebar,
  buildCategoryListingSelection,
  getCategoryPanelSections,
  getSubcategoryOptions,
  type CategoryPanelSectionView,
} from '../data/catalogCategories'
import { getCategoryNavIcon } from '../data/categoryNavIcons'
import { getAllCategoriesListingSelection } from '../data/categoryListing'
import type { CategoryListingSelection } from '../data/categoryListing'
import type { SidebarCategoryId, Subcategory } from '../data/categoriesModal'
import { formatCompactCount, splitDisplayPrice } from '../data/format'
import type { Product } from '../data/products'
import { getProductPath } from '../data/shopRoutes'

type CategoriesModalProps = {
  isOpen: boolean
  initialCategoryId: SidebarCategoryId | string
  onClose: () => void
  onSubcategorySelect: (selection: CategoryListingSelection) => void
}

const TOP_SELLER_COUNT = 4

/** The virtual entries read better under the names the link bar uses. */
const departmentLabels: Record<string, string> = {
  featured: 'Best Sellers',
  'new-releases': 'New Releases',
}

function productsInDepartment(products: Product[], departmentId: string): Product[] {
  return products.filter(
    (product) =>
      product.categoryId === departmentId || String(product.categoryId).startsWith(`${departmentId}-`),
  )
}

function bySoldCount(a: Product, b: Product): number {
  return (b.soldCount ?? 0) - (a.soldCount ?? 0)
}

/** Square photo tile for one subcategory. */
function SubcategoryTile({
  item,
  onSelect,
  size = 'regular',
}: {
  item: Subcategory
  onSelect: () => void
  size?: 'regular' | 'compact'
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex min-w-0 cursor-pointer flex-col gap-2 text-left"
    >
      <span
        className={`relative block aspect-square w-full overflow-hidden bg-bg-secondary ring-brand transition-shadow group-hover:ring-2 ${
          size === 'compact' ? 'rounded-xl' : 'rounded-2xl'
        }`}
      >
        {item.image ? (
          <img
            alt=""
            loading="lazy"
            src={item.image}
            className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
      </span>
      <span
        className={`line-clamp-2 font-semibold leading-tight text-text-primary group-hover:text-brand ${
          size === 'compact' ? 'text-xs' : 'text-xs lg:text-sm'
        }`}
      >
        {item.label}
      </span>
    </button>
  )
}

/** A compact best-seller row: thumbnail, name, rating and price. */
function TopSellerItem({ product, onNavigate }: { product: Product; onNavigate: () => void }) {
  const { currency, amount } = splitDisplayPrice(product.price)
  const rating = Number.parseFloat(product.rating)

  return (
    <Link
      to={getProductPath(product.id, { categoryId: String(product.categoryId) })}
      onClick={onNavigate}
      className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border-primary p-2 transition-colors hover:border-brand-lighter hover:bg-brand-light/50"
    >
      <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-bg-secondary">
        <img alt="" loading="lazy" src={product.image} className="absolute inset-0 size-full object-cover" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="line-clamp-2 text-xs font-semibold leading-tight text-text-primary group-hover:text-brand">
          {product.name}
        </span>
        {Number.isFinite(rating) && rating > 0 ? (
          <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
            <StarFillIcon className="size-3 text-primary-gold" aria-hidden />
            {rating.toFixed(1)}
            {product.soldCount ? <span>· {formatCompactCount(product.soldCount)} sold</span> : null}
          </span>
        ) : null}
        <span className="tabular-price flex items-baseline gap-0.5 text-sm font-bold text-text-primary">
          {currency ? <span className="text-[10px]">{currency}</span> : null}
          {amount}
        </span>
      </span>
    </Link>
  )
}

/**
 * The olloo mega menu.
 *
 * Desktop: a department rail on the left that switches the right pane on hover
 * (or focus, for keyboard users), and a pane with a "Shop all" link, photo
 * tiles for each subcategory and the department's best sellers.
 * Phones: the same rail runs down the left edge with the pane beside it, app
 * style, so switching department is one tap with no back button.
 */
export function CategoriesModal({
  isOpen,
  initialCategoryId,
  onClose,
  onSubcategorySelect,
}: CategoriesModalProps) {
  const { categories, allProducts, featuredProducts, newArrivalProducts } = useCatalog()
  const departments = useMemo(
    () =>
      buildCatalogSidebar(categories)
        .filter((entry) => entry.id !== 'all-categories')
        .map((entry) => ({ ...entry, label: departmentLabels[entry.id] ?? entry.label })),
    [categories],
  )
  const [selectedId, setSelectedId] = useState<string>('featured')
  const paneRefs = useRef<Array<HTMLDivElement | null>>([])

  useEffect(() => {
    if (!isOpen) return
    setSelectedId(initialCategoryId === 'all-categories' ? 'featured' : initialCategoryId)
  }, [initialCategoryId, isOpen])

  // A new department starts at the top of its pane, on both layouts.
  useEffect(() => {
    paneRefs.current.forEach((pane) => pane?.scrollTo({ top: 0 }))
  }, [selectedId])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const selected = departments.find((department) => department.id === selectedId) ?? departments[0]
  const sections: CategoryPanelSectionView[] = selected
    ? getCategoryPanelSections(selected.id, categories)
    : []
  const isDiscovery = selected?.id === 'featured' || selected?.id === 'new-releases'

  const topSellers = useMemo(() => {
    if (!selected) return []
    const pool =
      selected.id === 'featured'
        ? featuredProducts
        : selected.id === 'new-releases'
          ? newArrivalProducts
          : productsInDepartment(allProducts, selected.id)
    return [...pool].sort(bySoldCount).slice(0, TOP_SELLER_COUNT)
  }, [allProducts, featuredProducts, newArrivalProducts, selected])

  const productCount = selected && !isDiscovery ? productsInDepartment(allProducts, selected.id).length : null

  if (!isOpen || !selected) return null

  const shopAll = () => onSubcategorySelect(buildCategoryListingSelection(selected.id, categories))
  const browseEverything = () => onSubcategorySelect(getAllCategoriesListingSelection(categories))

  const selectSubcategory = (section: CategoryPanelSectionView, item: Subcategory) =>
    onSubcategorySelect({
      categoryId: section.sectionId,
      categoryLabel: section.title,
      subcategoryLabel: item.label,
      subcategoryOptions: getSubcategoryOptions(section.sectionId, categories),
    })

  const renderPane = (layout: 'desktop' | 'mobile') => {
    const isMobile = layout === 'mobile'
    const SelectedIcon = getCategoryNavIcon(selected.id)

    return (
      <div className="flex flex-col gap-5 lg:gap-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-light text-brand lg:flex">
              <SelectedIcon className="size-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="font-display truncate text-lg font-bold tracking-[-0.02em] text-text-primary lg:text-2xl">
                {selected.label}
              </h2>
              {productCount !== null ? (
                <p className="text-xs text-text-tertiary">
                  {productCount} {productCount === 1 ? 'product' : 'products'}
                </p>
              ) : (
                <p className="text-xs text-text-tertiary">Shortcuts across every department</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={shopAll}
            className="group flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-brand px-3.5 py-2 text-xs font-bold text-text-inverse transition-colors hover:bg-brand-dark lg:px-4 lg:text-sm"
          >
            Shop all
            <ArrowRightLineIcon className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>
        </div>

        {/* Desktop puts best sellers beside the tiles so both are visible
            without scrolling; phones stack them. */}
        <div className={isMobile ? 'flex flex-col gap-5' : 'grid grid-cols-[minmax(0,1fr)_280px] items-start gap-6'}>
          <div className="flex min-w-0 flex-col gap-5">
          {isDiscovery ? (
            sections.map((section) => (
              <section key={section.sectionId} className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-text-secondary">{section.title}</h3>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {section.items.map((item) => (
                    <SubcategoryTile
                      key={`${section.sectionId}-${item.label}`}
                      item={item}
                      size="compact"
                      onSelect={() => selectSubcategory(section, item)}
                    />
                  ))}
                </div>
              </section>
            ))
          ) : sections[0] && sections[0].items.length > 0 ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-4 lg:gap-4 xl:grid-cols-5">
              {sections[0].items.map((item) => (
                <SubcategoryTile
                  key={item.label}
                  item={item}
                  onSelect={() => selectSubcategory(sections[0], item)}
                />
              ))}
            </div>
          ) : null}
          </div>
          {topSellers.length > 0 ? (
            <section
              className={`flex flex-col gap-3 ${
                isMobile ? 'border-t border-border-primary pt-5' : 'lg:border-l lg:border-border-primary lg:pl-6'
              }`}
            >
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-text-primary">
                <FireFillIcon className="size-4 text-primary-red" aria-hidden />
                {selected.id === 'new-releases' ? 'Just landed' : `Top sellers in ${selected.label}`}
              </h3>
              <div className="flex flex-col gap-2">
                {topSellers.map((product) => (
                  <TopSellerItem key={product.id} product={product} onNavigate={onClose} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close categories"
        className="fixed inset-x-0 bottom-0 top-(--nav-height,8rem) z-40 cursor-default bg-ink/50"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="All categories"
        className="absolute inset-x-0 top-full z-50 border-t border-border-primary bg-bg-primary shadow-float"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Desktop mega menu */}
        <div className="mx-auto hidden h-[min(560px,calc(100dvh-var(--nav-height,8rem)-1.5rem))] max-w-400 grid-cols-[264px_minmax(0,1fr)] gap-6 px-16 py-5 lg:grid">
          <nav aria-label="Departments" className="flex min-h-0 flex-col border-r border-border-primary pr-4">
            <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto scrollbar-none">
              {departments.map((department) => {
                const isActive = department.id === selected.id
                const DepartmentIcon = getCategoryNavIcon(department.id)

                return (
                  <li key={department.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setSelectedId(department.id)}
                      onFocus={() => setSelectedId(department.id)}
                      onClick={() => setSelectedId(department.id)}
                      aria-current={isActive ? 'true' : undefined}
                      className={`group relative flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left transition-colors ${
                        isActive ? 'bg-brand-light text-brand' : 'text-text-secondary hover:bg-bg-secondary'
                      }`}
                    >
                      {isActive ? (
                        <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-full bg-brand" />
                      ) : null}
                      <DepartmentIcon className="size-5 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{department.label}</span>
                      <ArrowRightSLineIcon
                        className={`size-4 shrink-0 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`}
                        aria-hidden
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              onClick={browseEverything}
              className="mt-3 flex h-11 cursor-pointer items-center gap-3 rounded-xl border border-border-secondary px-3 text-sm font-bold text-text-primary transition-colors hover:border-brand hover:text-brand"
            >
              <AppsLineIcon className="size-5" aria-hidden />
              Browse all products
            </button>
          </nav>

          <div
            ref={(node) => {
              paneRefs.current[0] = node
            }}
            className="min-h-0 overflow-y-auto pr-1"
          >
            {renderPane('desktop')}
          </div>
        </div>

        {/* Phone layout: department rail beside the pane, app style. */}
        <div className="flex h-[calc(100dvh-var(--nav-height,8rem)-4.75rem)] lg:hidden">
          <nav aria-label="Departments" className="w-23 shrink-0 overflow-y-auto bg-bg-secondary scrollbar-none">
            <ul className="flex flex-col">
              {departments.map((department) => {
                const isActive = department.id === selected.id
                const DepartmentIcon = getCategoryNavIcon(department.id)

                return (
                  <li key={department.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(department.id)}
                      aria-current={isActive ? 'true' : undefined}
                      className={`relative flex w-full cursor-pointer flex-col items-center gap-1 px-1.5 py-3 text-center ${
                        isActive ? 'bg-bg-primary text-brand' : 'text-text-secondary'
                      }`}
                    >
                      {isActive ? (
                        <span aria-hidden className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-brand" />
                      ) : null}
                      <DepartmentIcon className="size-5" aria-hidden />
                      <span className={`line-clamp-2 text-[11px] leading-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
                        {department.label}
                      </span>
                    </button>
                  </li>
                )
              })}
              <li>
                <button
                  type="button"
                  onClick={browseEverything}
                  className="flex w-full cursor-pointer flex-col items-center gap-1 px-1.5 py-3 text-center text-text-secondary"
                >
                  <AppsLineIcon className="size-5" aria-hidden />
                  <span className="text-[11px] font-medium leading-tight">All products</span>
                </button>
              </li>
            </ul>
          </nav>
          <div
            ref={(node) => {
              paneRefs.current[1] = node
            }}
            className="min-w-0 flex-1 overflow-y-auto p-3 pb-6"
          >
            {renderPane('mobile')}
          </div>
        </div>
      </div>
    </>
  )
}
