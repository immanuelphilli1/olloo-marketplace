import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ArrowLeftSLineIcon from 'remixicon-react/ArrowLeftSLineIcon'
import ArrowRightSLineIcon from 'remixicon-react/ArrowRightSLineIcon'
import { useCatalog } from '../context/CatalogContext'
import {
  buildCatalogSidebar,
  getCategoryPanelSections,
  getSubcategoryOptions,
  type CategoryPanelSectionView,
} from '../data/catalogCategories'
import { getCategoryNavIcon } from '../data/categoryNavIcons'
import { getAllCategoriesListingSelection } from '../data/categoryListing'
import type { CategoryListingSelection } from '../data/categoryListing'
import {
  ALL_PRODUCTS_LABEL,
  type SidebarCategoryId,
  type Subcategory,
} from '../data/categoriesModal'

type CategoriesModalProps = {
  isOpen: boolean
  initialCategoryId: SidebarCategoryId | string
  openToInitialCategory?: boolean
  onClose: () => void
  onSubcategorySelect: (selection: CategoryListingSelection) => void
}

type MobileView = 'list' | 'detail'

function CategoryIcon({
  categoryId,
  className = 'size-6',
  isActive = false,
}: {
  categoryId: string
  className?: string
  isActive?: boolean
}) {
  const IconComponent = getCategoryNavIcon(categoryId)

  return (
    <IconComponent
      className={`shrink-0 transition-colors ${className} ${
        isActive ? 'text-primary-orange' : 'text-text-secondary'
      }`}
      aria-hidden
    />
  )
}

function CategoryLinkButton({
  category,
  isActive = false,
  onClick,
  showActiveState = true,
}: {
  category: { id: string; label: string }
  isActive?: boolean
  onClick: () => void
  showActiveState?: boolean
}) {
  const active = showActiveState && isActive

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-12 w-full items-center gap-2 rounded-lg p-4 text-left transition-colors ${
        active ? 'bg-orange-light' : 'hover:bg-bg-secondary active:bg-bg-secondary'
      }`}
    >
      <CategoryIcon categoryId={category.id} isActive={active} />
      <span
        className={`min-w-0 flex-1 text-base font-medium tracking-[-0.32px] ${
          active ? 'text-primary-orange' : 'text-text-secondary'
        }`}
      >
        {category.label}
      </span>
      <ArrowRightSLineIcon className="size-6 shrink-0 text-text-secondary" aria-hidden />
    </button>
  )
}

function SubcategoryCard({
  label,
  image,
  onSelect,
}: Subcategory & { onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className="flex flex-col items-center gap-2 text-center">
      <div className="relative size-24 shrink-0 overflow-hidden rounded-full bg-bg-secondary">
        {image ? <img alt="" className="size-full object-cover" src={image} /> : null}
      </div>
      <span className="line-clamp-2 w-full text-base font-medium tracking-[-0.32px] text-text-primary">
        {label}
      </span>
    </button>
  )
}

function CategorySectionPanel({
  sectionId,
  title,
  items,
  onSubcategorySelect,
}: {
  sectionId: string
  title: string
  items: Subcategory[]
  onSubcategorySelect: (selection: CategoryListingSelection) => void
}) {
  const { categories } = useCatalog()
  const subcategoryOptions = getSubcategoryOptions(sectionId, categories)

  return (
    <section data-section-id={sectionId} className="flex scroll-mt-4 flex-col gap-2">
      <h3 className="text-2xl font-medium tracking-[-0.48px] text-text-primary">{title}</h3>
      <div className="grid grid-cols-3 gap-x-8 gap-y-8 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7">
        {items.map((item) => (
          <SubcategoryCard
            key={`${title}-${item.label}`}
            {...item}
            onSelect={() =>
              onSubcategorySelect({
                categoryId: sectionId,
                categoryLabel: title,
                subcategoryLabel: item.label,
                subcategoryOptions,
              })
            }
          />
        ))}
      </div>
    </section>
  )
}

function CategorySections({
  sections,
  onSubcategorySelect,
}: {
  sections: CategoryPanelSectionView[]
  onSubcategorySelect: (selection: CategoryListingSelection) => void
}) {
  return (
    <div className="flex flex-col gap-8">
      {sections.map((section) => (
        <CategorySectionPanel
          key={`${section.sectionId}-${section.title}`}
          sectionId={section.sectionId}
          title={section.title}
          items={section.items}
          onSubcategorySelect={onSubcategorySelect}
        />
      ))}
    </div>
  )
}

export function CategoriesModal({
  isOpen,
  initialCategoryId,
  openToInitialCategory = false,
  onClose,
  onSubcategorySelect,
}: CategoriesModalProps) {
  const { categories } = useCatalog()
  const sidebarEntries = useMemo(() => buildCatalogSidebar(categories), [categories])
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState<string>('featured')
  const [mobileView, setMobileView] = useState<MobileView>('list')

  const sections = getCategoryPanelSections(selectedId, categories)
  const selectedCategory = sidebarEntries.find((category) => category.id === selectedId)

  const handleMobileCategorySelect = useCallback(
    (categoryId: string) => {
      if (categoryId === 'all-categories') {
        onSubcategorySelect(getAllCategoriesListingSelection(categories))
        return
      }

      setSelectedId(categoryId)
      setMobileView('detail')
    },
    [categories, onSubcategorySelect],
  )

  const handleMobileBack = useCallback(() => {
    setMobileView('list')
  }, [])

  useEffect(() => {
    if (!isOpen) return

    setSelectedId(initialCategoryId)
    setMobileView(
      window.matchMedia('(max-width: 1023px)').matches &&
        openToInitialCategory &&
        initialCategoryId !== 'featured'
        ? 'detail'
        : 'list',
    )
    scrollContainerRef.current?.scrollTo({ top: 0 })
  }, [initialCategoryId, isOpen, openToInitialCategory])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (mobileView === 'detail' && window.matchMedia('(max-width: 1023px)').matches) {
          setMobileView('list')
          return
        }

        onClose()
      }
    }

    document.body.style.overflow = 'hidden'
    document.body.style.width = '100%'
    document.addEventListener('keydown', handleKeyDown)

    const handleResize = () => {
      document.body.style.width = '100%'
    }

    window.addEventListener('resize', handleResize)

    return () => {
      document.body.style.overflow = ''
      document.body.style.width = ''
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleResize)
    }
  }, [isOpen, mobileView, onClose])

  if (!isOpen) return null

  return (
    <>
      <button
        type="button"
        aria-label="Close categories"
        className="fixed inset-x-0 bottom-0 top-(--nav-height,8rem) z-40 bg-[rgba(0,6,7,0.7)]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Categories"
        className="absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-178px)] overflow-hidden bg-bg-primary shadow-lg lg:max-h-175 lg:px-16 lg:py-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto flex h-full max-h-[inherit] w-full max-w-360 overflow-hidden lg:max-h-167">
          <div
            ref={scrollContainerRef}
            className="hidden min-w-0 flex-1 overflow-y-auto p-4 lg:block"
          >
            <CategorySections sections={sections} onSubcategorySelect={onSubcategorySelect} />
          </div>

          {mobileView === 'list' ? (
            <nav className="flex w-full flex-col overflow-y-auto p-2 lg:hidden">
              {sidebarEntries.map((category) => (
                <CategoryLinkButton
                  key={category.id}
                  category={{
                    ...category,
                    label:
                      category.id === 'all-categories' ? ALL_PRODUCTS_LABEL : category.label,
                  }}
                  onClick={() => handleMobileCategorySelect(category.id)}
                  showActiveState={false}
                />
              ))}
            </nav>
          ) : (
            <div className="flex min-h-0 w-full flex-col overflow-y-auto lg:hidden">
              <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border-primary bg-bg-primary p-4">
                <button
                  type="button"
                  onClick={handleMobileBack}
                  aria-label="Back to categories"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bg-secondary transition-colors hover:bg-orange-light active:bg-orange-light"
                >
                  <ArrowLeftSLineIcon className="size-5 text-text-secondary" aria-hidden />
                </button>
                <h2 className="min-w-0 flex-1 text-base font-medium tracking-[-0.32px] text-text-primary">
                  {selectedCategory?.label}
                </h2>
              </div>

              <div className="p-4">
                <CategorySections sections={sections} onSubcategorySelect={onSubcategorySelect} />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
