import { useEffect, useRef, useState, type ReactNode } from 'react'
import AddLineIcon from 'remixicon-react/AddLineIcon'
import ArrowUpSLineIcon from 'remixicon-react/ArrowUpSLineIcon'
import FilterLineIcon from 'remixicon-react/FilterLineIcon'
import SubtractLineIcon from 'remixicon-react/SubtractLineIcon'
import {
  collapsedFilterSections,
  defaultListingFilters,
  isPriceFilterActive,
  mobileCollapsedFilterSections,
  PRICE_FLOOR,
  type ListingFilters,
} from '../data/categoryListing'
import { ALL_PRODUCTS_LABEL } from '../data/categoriesModal'
import type { ProductFacets } from '../api/types'

export type OpenSections = {
  price: boolean
  category: boolean
  rating: boolean
  delivery: boolean
  screenSize: boolean
  brand: boolean
  color: boolean
  seller: boolean
  connectivity: boolean
  storage: boolean
}

export const defaultOpenSections: OpenSections = {
  price: true,
  category: true,
  rating: true,
  delivery: true,
  screenSize: true,
  brand: false,
  color: false,
  seller: false,
  connectivity: false,
  storage: false,
}

type FilterVariant = 'sidebar' | 'mobile'

type FilterSectionProps = {
  title: string
  isOpen: boolean
  onToggle: () => void
  children?: ReactNode
  variant: FilterVariant
  /** When set, a "Clear" link appears beside the title. */
  onClear?: () => void
}

function FilterSection({
  title,
  isOpen,
  onToggle,
  children,
  variant,
  onClear,
}: FilterSectionProps) {
  const isMobile = variant === 'mobile'

  return (
    <div
      className={`border-b border-border-primary ${isMobile ? 'py-4' : 'p-4'}`}
    >
      <div className="flex w-full items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
        >
          <span
            className={`flex-1 font-medium text-text-secondary ${
              isMobile
                ? 'text-sm leading-4.5 tracking-[-0.28px]'
                : 'text-sm leading-4 tracking-[-0.28px]'
            }`}
          >
            {title}
          </span>
          <ArrowUpSLineIcon
            className={`size-6 shrink-0 text-text-secondary transition-transform ${
              isOpen ? '' : 'rotate-180'
            }`}
            aria-hidden
          />
        </button>
        {/* A sibling of the toggle, not a child: nesting a control inside the
            toggle button is invalid and clicking it would also collapse the
            section. */}
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Clear ${title} filter`}
            className="shrink-0 cursor-pointer text-sm font-medium leading-4 tracking-[-0.28px] text-primary-orange"
          >
            Clear
          </button>
        ) : null}
      </div>
      {isOpen && children ? (
        <div className={`flex flex-col gap-2 ${isMobile ? 'mt-2' : 'mt-2'}`}>{children}</div>
      ) : null}
    </div>
  )
}

function FilterRadioOption({
  label,
  isSelected,
  onSelect,
  trailing,
  variant,
}: {
  label: string
  isSelected: boolean
  onSelect: () => void
  trailing?: ReactNode
  variant: FilterVariant
}) {
  const isMobile = variant === 'mobile'

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full cursor-pointer items-center gap-2 text-left ${
        isMobile ? 'py-1' : 'py-1'
      }`}
    >
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
          isSelected ? 'border-primary-orange' : 'border-border-secondary'
        }`}
      >
        {isSelected ? <span className="size-2.5 rounded-full bg-primary-orange" /> : null}
      </span>
      {trailing ?? (
        <span
          className={`font-medium text-text-secondary ${
            isMobile
              ? 'text-sm leading-4.5 tracking-[-0.28px]'
              : 'text-sm leading-4 tracking-[-0.28px]'
          }`}
        >
          {label}
        </span>
      )}
    </button>
  )
}

type PriceRangeSliderProps = {
  variant: FilterVariant
  priceCeiling: number
  priceCurrency: string
  minPrice: number
  maxPrice: number | null
  onMinPriceChange: (value: number) => void
  onMaxPriceChange: (value: number | null) => void
}

function PriceRangeSlider({
  variant,
  priceCeiling,
  priceCurrency,
  minPrice,
  maxPrice,
  onMinPriceChange,
  onMaxPriceChange,
}: PriceRangeSliderProps) {
  const isMobile = variant === 'mobile'
  const sliderMax = Math.max(priceCeiling, PRICE_FLOOR + 1)
  const displayedMax = maxPrice ?? sliderMax
  const step = sliderMax <= 1000 ? 50 : 100

  // The track is expressed as percentages so the handles can be positioned with
  // inline styles; the two handles share the full [floor, ceiling] range and are
  // prevented from crossing by clamping on change.
  const priceSpan = sliderMax - PRICE_FLOOR
  const toPercent = (value: number) => ((value - PRICE_FLOOR) / priceSpan) * 100

  const handleMinChange = (value: number) => {
    onMinPriceChange(Math.min(value, displayedMax))
  }

  const handleMaxChange = (value: number) => {
    const clamped = Math.max(value, minPrice)
    if (clamped >= sliderMax) {
      onMaxPriceChange(null)
      return
    }
    onMaxPriceChange(clamped)
  }

  const minPercent = toPercent(minPrice)
  const maxPercent = toPercent(displayedMax)

  return (
    <>
      <div
        className={`relative w-full ${isMobile ? 'flex h-6 items-center justify-center' : 'h-6'}`}
      >
        <div className={`relative h-6 ${isMobile ? 'w-58 max-w-full' : 'w-full'}`}>
          <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-bg-tertiary" />
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary-orange"
            style={{ left: `${minPercent}%`, width: `${maxPercent - minPercent}%` }}
          />
          {/* Two stacked range inputs drive the track: the lower one owns the
              left handle, the upper one the right. Only the thumbs are
              interactive, so the invisible tracks never steal each other's
              drags. The upper handle is raised so it stays grabbable when the
              two handles meet at the same value. */}
          <input
            type="range"
            min={PRICE_FLOOR}
            max={sliderMax}
            step={step}
            value={minPrice}
            onChange={(event) => handleMinChange(Number(event.target.value))}
            aria-label="Minimum price"
            className="pointer-events-none absolute inset-0 z-20 size-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-primary-orange [&::-webkit-slider-thumb]:shadow-[0px_1px_4px_0px_rgba(0,0,0,0.04),0px_4px_12px_0px_rgba(0,0,0,0.06)] [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-primary-orange"
          />
          <input
            type="range"
            min={PRICE_FLOOR}
            max={sliderMax}
            step={step}
            value={displayedMax}
            onChange={(event) => handleMaxChange(Number(event.target.value))}
            aria-label="Maximum price"
            className="pointer-events-none absolute inset-0 size-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-primary-orange [&::-webkit-slider-thumb]:shadow-[0px_1px_4px_0px_rgba(0,0,0,0.04),0px_4px_12px_0px_rgba(0,0,0,0.06)] [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-primary-orange"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-1 rounded-lg border border-border-secondary p-2 text-sm font-medium tracking-[-0.28px]">
          <span className="text-text-tertiary">{priceCurrency}</span>
          <span className="text-text-secondary">{minPrice}</span>
        </div>
        <SubtractLineIcon className="size-6 shrink-0 text-text-secondary" aria-hidden />
        <div className="flex flex-1 items-center gap-1 rounded-lg border border-border-secondary p-2 text-sm font-medium tracking-[-0.28px]">
          <span className="text-text-tertiary">{priceCurrency}</span>
          <span className="text-text-secondary">{maxPrice ?? sliderMax}</span>
        </div>
      </div>
    </>
  )
}

function ListingFiltersContent({
  variant,
  headerTitle,
  selectedCategory,
  categoryOptions,
  onCategoryChange,
  openSections,
  onToggleSection,
  filters,
  onFiltersChange,
  facets,
  priceCeiling,
  priceCurrency,
  showAllCategoryOption = false,
  showAllProductOption = false,
}: {
  variant: FilterVariant
  headerTitle: string
  selectedCategory: string
  categoryOptions: string[]
  onCategoryChange: (label: string) => void
  openSections: OpenSections
  onToggleSection: (key: keyof OpenSections) => void
  filters: ListingFilters
  onFiltersChange: (next: ListingFilters) => void
  facets: ProductFacets
  priceCeiling: number
  priceCurrency: string
  showAllCategoryOption?: boolean
  showAllProductOption?: boolean
}) {
  const isMobile = variant === 'mobile'
  const resolvedHeaderClassName = isMobile
    ? 'py-2'
    : 'border-b border-border-primary px-4 py-2'

  // The preview leaves room for the leading "All categories" / "All products"
  // entries so the visible slice of subcategories stays short.
  const leadingOptionCount = (showAllCategoryOption ? 1 : 0) + (showAllProductOption ? 1 : 0)
  const categoryPreviewCount = Math.max(1, (isMobile ? 4 : 4) - leadingOptionCount)
  const categoryOverflowThreshold = categoryPreviewCount

  // Facets come from the API, so the options are exactly the values the catalog
  // can be filtered by. Delivery options are derived from the API's delivery
  // facet, which is null unless the request carried a destination country; when
  // that happens the section hides entirely rather than offering options that
  // match nothing. Each list is defaulted to [] so a missing or malformed facet
  // can never throw on .length.
  const deliveryOptions = facets.deliveryOptions ?? []
  const screenSizeOptions = facets.screenSizes ?? []
  const colorOptions = facets.colors ?? []
  const brandOptions = facets.brands ?? []

  // Each section only offers Clear once it actually deviates from the default,
  // so an untouched panel stays free of dead links.
  const isPriceFiltered = isPriceFilterActive(filters)
  const isCategoryFiltered = selectedCategory !== 'all' && selectedCategory !== ''

  return (
    <>
      <div className={resolvedHeaderClassName}>
        <p className="text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
          {headerTitle}
        </p>
      </div>

      <FilterSection
        title="Price"
        isOpen={openSections.price}
        onToggle={() => onToggleSection('price')}
        onClear={
          isPriceFiltered
            ? () =>
                onFiltersChange({
                  ...filters,
                  minPrice: defaultListingFilters.minPrice,
                  maxPrice: defaultListingFilters.maxPrice,
                })
            : undefined
        }
        variant={variant}
      >
        <PriceRangeSlider
          variant={variant}
          priceCeiling={priceCeiling}
          priceCurrency={priceCurrency}
          minPrice={filters.minPrice}
          maxPrice={filters.maxPrice}
          onMinPriceChange={(value) => onFiltersChange({ ...filters, minPrice: value })}
          onMaxPriceChange={(value) => onFiltersChange({ ...filters, maxPrice: value })}
        />
      </FilterSection>

      {categoryOptions.length > 0 ? (
        <FilterSection
          title="Category"
          isOpen={openSections.category}
          onToggle={() => onToggleSection('category')}
          onClear={isCategoryFiltered ? () => onCategoryChange('all') : undefined}
          variant={variant}
        >
          {/* "All categories" sits above the real subcategories: it is the
              unfiltered option, so listing it last would bury it. */}
          {showAllCategoryOption ? (
            <FilterRadioOption
              label="All categories"
              isSelected={selectedCategory === 'all'}
              onSelect={() => onCategoryChange('all')}
              variant={variant}
            />
          ) : null}
          {showAllProductOption ? (
            <FilterRadioOption
              label={ALL_PRODUCTS_LABEL}
              isSelected={selectedCategory === ALL_PRODUCTS_LABEL}
              onSelect={() => onCategoryChange(ALL_PRODUCTS_LABEL)}
              variant={variant}
            />
          ) : null}
          {categoryOptions.slice(0, categoryPreviewCount).map((label) => (
            <FilterRadioOption
              key={label}
              label={label}
              isSelected={selectedCategory === label}
              onSelect={() => onCategoryChange(label)}
              variant={variant}
            />
          ))}
          {categoryOptions.length > categoryOverflowThreshold ? (
            <button
              type="button"
              className="flex cursor-pointer items-center gap-2 text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-secondary"
            >
              <AddLineIcon className="size-5 shrink-0" aria-hidden />
              View More
            </button>
          ) : null}
        </FilterSection>
      ) : null}

      {isMobile ? (
        screenSizeOptions.length > 0 ? (
          <FilterSection
            title="Screen Size"
            isOpen={openSections.screenSize}
            onToggle={() => onToggleSection('screenSize')}
            onClear={
              filters.screenSize
                ? () => onFiltersChange({ ...filters, screenSize: '' })
                : undefined
            }
            variant={variant}
          >
            {screenSizeOptions.map((label) => (
              <FilterRadioOption
                key={label}
                label={label}
                isSelected={filters.screenSize === label}
                onSelect={() => onFiltersChange({ ...filters, screenSize: label })}
                variant={variant}
              />
            ))}
          </FilterSection>
        ) : null
      ) : deliveryOptions.length > 0 ? (
        <FilterSection
          title="Delivery"
          isOpen={openSections.delivery}
          onToggle={() => onToggleSection('delivery')}
          onClear={
            filters.delivery ? () => onFiltersChange({ ...filters, delivery: '' }) : undefined
          }
          variant={variant}
        >
          {deliveryOptions.map((label) => (
            <FilterRadioOption
              key={label}
              label={label}
              isSelected={filters.delivery === label}
              onSelect={() =>
                onFiltersChange({
                  ...filters,
                  // Re-selecting the active value clears it, so a single-choice
                  // facet can be turned off.
                  delivery: filters.delivery === label ? '' : label,
                })
              }
              variant={variant}
            />
          ))}
        </FilterSection>
      ) : null}

      {brandOptions.length > 0 ? (
        <FilterSection
          title="Brand"
          isOpen={openSections.brand}
          onToggle={() => onToggleSection('brand')}
          onClear={
            filters.brand ? () => onFiltersChange({ ...filters, brand: '' }) : undefined
          }
          variant={variant}
        >
          {brandOptions.map((label) => (
            <FilterRadioOption
              key={label}
              label={label}
              isSelected={filters.brand === label}
              onSelect={() => onFiltersChange({ ...filters, brand: filters.brand === label ? '' : label })}
              variant={variant}
            />
          ))}
        </FilterSection>
      ) : null}

      {colorOptions.length > 0 ? (
        <FilterSection
          title="Color"
          isOpen={openSections.color}
          onToggle={() => onToggleSection('color')}
          onClear={
            filters.color ? () => onFiltersChange({ ...filters, color: '' }) : undefined
          }
          variant={variant}
        >
          {colorOptions.map((label) => (
            <FilterRadioOption
              key={label}
              label={label}
              isSelected={filters.color === label}
              onSelect={() => onFiltersChange({ ...filters, color: filters.color === label ? '' : label })}
              variant={variant}
            />
          ))}
        </FilterSection>
      ) : null}

      {(isMobile ? mobileCollapsedFilterSections : collapsedFilterSections).map((title) => {
        const key = title.toLowerCase() as keyof OpenSections
        // Brand and Color are rendered above from live facets, so they are
        // filtered out here to avoid rendering the same section twice.
        if (key === 'brand' || key === 'color') {
          return null
        }

        return (
          <FilterSection
            key={title}
            title={title}
            isOpen={openSections[key]}
            onToggle={() => onToggleSection(key)}
            variant={variant}
          />
        )
      })}
    </>
  )
}

export function ListingFiltersSidebar({
  selectedCategory,
  categoryOptions,
  onCategoryChange,
  openSections,
  onToggleSection,
  filters,
  onFiltersChange,
  facets,
  priceCeiling,
  priceCurrency,
  showAllCategoryOption = false,
  showAllProductOption = false,
}: {
  selectedCategory: string
  categoryOptions: string[]
  onCategoryChange: (label: string) => void
  openSections: OpenSections
  onToggleSection: (key: keyof OpenSections) => void
  filters: ListingFilters
  onFiltersChange: (next: ListingFilters) => void
  facets: ProductFacets
  priceCeiling: number
  priceCurrency: string
  showAllCategoryOption?: boolean
  showAllProductOption?: boolean
}) {
  return (
    <aside className="hidden w-66 shrink-0 flex-col overflow-hidden rounded-[12px] border border-border-primary lg:flex">
      <ListingFiltersContent
        variant="sidebar"
        headerTitle="Filter"
        selectedCategory={selectedCategory}
        categoryOptions={categoryOptions}
        onCategoryChange={onCategoryChange}
        openSections={openSections}
        onToggleSection={onToggleSection}
        filters={filters}
        onFiltersChange={onFiltersChange}
        facets={facets}
        priceCeiling={priceCeiling}
        priceCurrency={priceCurrency}
        showAllCategoryOption={showAllCategoryOption}
        showAllProductOption={showAllProductOption}
      />
    </aside>
  )
}

const mobileFiltersOverlayClass = 'top-[var(--nav-height,8rem)]'
const mobileFiltersPanelClass = 'top-[var(--listing-header-height,3.75rem)]'

export function MobileFiltersSheet({
  isOpen,
  draftCategory,
  categoryOptions,
  onDraftCategoryChange,
  openSections,
  onToggleSection,
  draftFilters,
  onDraftFiltersChange,
  facets,
  priceCeiling,
  priceCurrency,
  onClose,
  onSave,
  showAllCategoryOption = false,
  showAllProductOption = false,
}: {
  isOpen: boolean
  draftCategory: string
  categoryOptions: string[]
  onDraftCategoryChange: (label: string) => void
  openSections: OpenSections
  onToggleSection: (key: keyof OpenSections) => void
  draftFilters: ListingFilters
  onDraftFiltersChange: (next: ListingFilters) => void
  facets: ProductFacets
  priceCeiling: number
  priceCurrency: string
  onClose: () => void
  onSave: () => void
  showAllCategoryOption?: boolean
  showAllProductOption?: boolean
}) {
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

  if (!isOpen) return null

  return (
    <div
      className={`fixed inset-x-0 bottom-0 ${mobileFiltersOverlayClass} z-50 bg-[rgba(0,6,7,0.7)]/5 lg:hidden`}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`absolute inset-x-0 bottom-0 flex flex-col bg-bg-primary ${mobileFiltersPanelClass}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          <ListingFiltersContent
            variant="mobile"
            headerTitle="Filters"
            selectedCategory={draftCategory}
            categoryOptions={categoryOptions}
            onCategoryChange={onDraftCategoryChange}
            openSections={openSections}
            onToggleSection={onToggleSection}
            filters={draftFilters}
            onFiltersChange={onDraftFiltersChange}
            facets={facets}
            priceCeiling={priceCeiling}
            priceCurrency={priceCurrency}
            showAllCategoryOption={showAllCategoryOption}
            showAllProductOption={showAllProductOption}
          />
        </div>

        <div className="shrink-0 border-t border-border-primary px-4 py-4">
          <button
            type="button"
            onClick={onSave}
            className="btn-orange flex h-13 w-full cursor-pointer items-center justify-center rounded-full px-6 py-4"
          >
            <span className="text-base font-medium leading-5 tracking-[-0.32px] text-text-inverse">
              Save
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

export function MobileListingHeader({
  title,
  onOpenFilters,
}: {
  title: string
  onOpenFilters: () => void
}) {
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const header = headerRef.current
    if (!header) return

    const updateHeight = () => {
      document.documentElement.style.setProperty(
        '--listing-header-height',
        `${header.offsetHeight}px`,
      )
    }

    updateHeight()

    const observer = new ResizeObserver(updateHeight)
    observer.observe(header)

    return () => observer.disconnect()
  }, [title])

  return (
    <div
      ref={headerRef}
      className="flex items-center justify-between border-b border-border-primary px-4 py-3 lg:hidden"
    >
      <h1 className="min-w-0 flex-1 truncate pr-4 text-xl font-medium leading-6 tracking-[-0.4px] text-text-primary">
        {title}
      </h1>
      <button
        type="button"
        onClick={onOpenFilters}
        className="group flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-bg-secondary px-4 transition-colors hover:bg-orange-light active:bg-orange-light"
        aria-label="Open filters"
      >
        <FilterLineIcon
          className="size-5 text-text-secondary transition-colors group-hover:text-primary-orange"
          aria-hidden
        />
        <span className="text-sm font-medium leading-4 tracking-[-0.28px] text-text-secondary transition-colors group-hover:text-primary-orange">
          Filter
        </span>
      </button>
    </div>
  )
}

export function useListingFilters(defaultCategory: string) {
  const [activeCategory, setActiveCategory] = useState(defaultCategory)
  const [draftCategory, setDraftCategory] = useState(defaultCategory)
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false)
  const [openSections, setOpenSections] = useState(defaultOpenSections)
  // Committed filters drive the visible product list; the draft copy is what the
  // mobile sheet edits until "Save" is pressed, matching the category field's
  // existing apply-on-save behaviour.
  const [filters, setFilters] = useState<ListingFilters>(defaultListingFilters)
  const [draftFilters, setDraftFilters] = useState<ListingFilters>(defaultListingFilters)

  // Re-seed when the route changes. Without this the filter keeps the value it
  // had on mount, which is wrong when navigating between category pages or when
  // the real categories arrive after an initial static fallback. Adjusting state
  // during render (rather than in an effect) avoids a cascading second render.
  const [lastDefaultCategory, setLastDefaultCategory] = useState(defaultCategory)
  if (lastDefaultCategory !== defaultCategory) {
    setLastDefaultCategory(defaultCategory)
    setActiveCategory(defaultCategory)
    setDraftCategory(defaultCategory)
    // Facet selections belong to the previous page, so they are cleared on
    // navigation rather than leaking into the new category's results.
    setFilters(defaultListingFilters)
    setDraftFilters(defaultListingFilters)
  }

  const toggleSection = (key: keyof OpenSections) => {
    setOpenSections((sections) => ({ ...sections, [key]: !sections[key] }))
  }

  const openMobileFilters = () => {
    setDraftCategory(activeCategory)
    setDraftFilters(filters)
    setIsMobileFiltersOpen(true)
  }

  const closeMobileFilters = () => {
    setIsMobileFiltersOpen(false)
  }

  const saveMobileFilters = () => {
    setActiveCategory(draftCategory)
    setFilters(draftFilters)
    setIsMobileFiltersOpen(false)
  }

  return {
    activeCategory,
    setActiveCategory,
    draftCategory,
    setDraftCategory,
    isMobileFiltersOpen,
    openSections,
    filters,
    setFilters,
    draftFilters,
    setDraftFilters,
    toggleSection,
    openMobileFilters,
    closeMobileFilters,
    saveMobileFilters,
  }
}
