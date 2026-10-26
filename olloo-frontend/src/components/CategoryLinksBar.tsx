import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useCatalog } from '../context/CatalogContext'
import { getCategoryNodeId } from '../data/catalogCategories'
import { getCategoryNavIcon, linkBarFixedIcons } from '../data/categoryNavIcons'
import { getCategoryPath } from '../data/shopRoutes'
import { images } from '../assets/images'
import { Icon } from './Icon'

type CategoryLink = {
  id: string
  label: string
  icon?: ReturnType<typeof getCategoryNavIcon>
  imageIcon?: string
}

type CategoryLinksBarProps = {
  /** Closes the mega menu when a link is followed, so it never covers the new page. */
  onNavigate?: () => void
}

/**
 * Department shortcuts under the header. Each one is a real link to its
 * listing; browsing every department at once is the mega menu's job.
 */
export function CategoryLinksBar({ onNavigate }: CategoryLinksBarProps) {
  const { categories: apiCategories } = useCatalog()
  const { pathname } = useLocation()
  // `/categories/electronics-headphones-audio` belongs to `electronics`, so
  // subcategory pages keep their department highlighted.
  const routeSegment = pathname.startsWith('/categories/') ? pathname.split('/')[2] : null

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

  return (
    <nav
      aria-label="Departments"
      className="hidden border-b border-border-primary bg-bg-primary px-4 lg:px-14"
    >
      <div className="mx-auto max-w-388 py-1.5">
        <ul className="flex gap-1 overflow-x-auto scrollbar-none mask-[linear-gradient(to_right,black_92%,transparent)]">
          {categoryLinks.map((category) => {
            const isActive =
              routeSegment !== null &&
              (routeSegment === category.id || routeSegment.startsWith(`${category.id}-`))
            const CategoryIcon = category.icon ?? getCategoryNavIcon(category.id)
            const iconClassName = `size-5 shrink-0 transition-colors ${
              isActive ? 'text-brand' : 'text-text-secondary group-hover:text-brand'
            }`

            return (
              <li key={category.id} className="shrink-0">
                <Link
                  to={getCategoryPath(category.id)}
                  onClick={() => {
                    onNavigate?.()
                    window.scrollTo({ top: 0 })
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group flex h-10 items-center gap-2 rounded-full px-3.5 transition-colors ${
                    isActive ? 'bg-brand-light' : 'hover:bg-bg-secondary'
                  }`}
                >
                  {category.imageIcon ? (
                    <Icon src={category.imageIcon} className={iconClassName} />
                  ) : (
                    <CategoryIcon className={iconClassName} aria-hidden />
                  )}
                  <span
                    className={`whitespace-nowrap text-sm font-semibold transition-colors ${
                      isActive ? 'text-brand' : 'text-text-secondary group-hover:text-text-primary'
                    }`}
                  >
                    {category.label}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
