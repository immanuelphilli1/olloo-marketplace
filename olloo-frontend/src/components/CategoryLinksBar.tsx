import { useMemo } from 'react'
import StarLineIcon from 'remixicon-react/StarLineIcon'
import { useCatalog } from '../context/CatalogContext'
import { getCategoryNodeId } from '../data/catalogCategories'
import { getCategoryNavIcon, linkBarFixedIcons } from '../data/categoryNavIcons'
import type { SidebarCategoryId } from '../data/categoriesModal'
import { Icon } from './Icon'
import { images } from '../assets/images'

type CategoryLink = {
  id: SidebarCategoryId | string
  label: string
  icon?: ReturnType<typeof getCategoryNavIcon>
  imageIcon?: string
}

const featuredLink: CategoryLink = {
  id: 'featured',
  label: 'Featured',
  icon: StarLineIcon,
}

type CategoryLinksBarProps = {
  onOpenCategories: (categoryId: SidebarCategoryId | string, label: string) => void
  activeCategoryId?: SidebarCategoryId | string
  isCategoriesOpen?: boolean
}

function CategoryLinkIcon({
  category,
  isActive,
}: {
  category: CategoryLink
  isActive: boolean
}) {
  const iconClassName = `size-6 shrink-0 transition-colors ${
    isActive ? 'text-primary-orange' : 'text-text-secondary group-hover:text-primary-orange'
  }`

  if (category.imageIcon) {
    return <Icon src={category.imageIcon} className={iconClassName} />
  }

  const CategoryIcon = category.icon ?? getCategoryNavIcon(category.id)
  return <CategoryIcon className={iconClassName} aria-hidden />
}

export function CategoryLinksBar({
  onOpenCategories,
  activeCategoryId = 'featured',
  isCategoriesOpen = false,
}: CategoryLinksBarProps) {
  const { categories: apiCategories } = useCatalog()

  const categoryLinks = useMemo((): CategoryLink[] => {
    const fixed: CategoryLink[] = [
      { id: 'featured', label: 'Best Sellers', icon: linkBarFixedIcons.featured },
      { id: 'new-releases', label: 'New Releases', icon: linkBarFixedIcons['new-releases'] },
    ]

    const fromApi: CategoryLink[] = apiCategories.map((category) => {
      const id = getCategoryNodeId(category)
      return {
        id,
        label: category.label,
        icon: getCategoryNavIcon(id),
        imageIcon: id === 'home-garden' ? images.hero.sofa : undefined,
      }
    })

    return [...fixed, ...fromApi]
  }, [apiCategories])

  const visibleLinks = isCategoriesOpen ? [featuredLink, ...categoryLinks] : categoryLinks

  return (
    <section className="hidden border-b border-border-primary bg-bg-primary px-4 lg:block lg:px-14">
      <div className="py-2 max-w-380 mx-auto">
        <div className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden">
          {visibleLinks.map((category) => {
            const isActive = isCategoriesOpen && category.id === activeCategoryId

            return (
              <button
                key={`${category.id}-${category.label}`}
                type="button"
                onClick={() => onOpenCategories(category.id, category.label)}
                className={`group flex h-12 shrink-0 cursor-pointer items-center gap-2 rounded-lg p-4 transition-colors ${
                  isActive ? 'bg-orange-light' : 'hover:bg-orange-light'
                }`}
              >
                <CategoryLinkIcon category={category} isActive={isActive} />
                <span
                  className={`whitespace-nowrap text-base font-medium tracking-[-0.32px] transition-colors ${
                    isActive
                      ? 'text-primary-orange'
                      : 'text-text-secondary group-hover:text-primary-orange'
                  }`}
                >
                  {category.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
