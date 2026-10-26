import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CategoryListingSelection } from '../data/categoryListing'
import { getMajorCategoryId } from '../data/catalogCategories'
import { useCatalog } from '../context/CatalogContext'
import { getCategoryPathFromSelection } from '../data/shopRoutes'

type UseCategoryNavigationOptions = {
  /** Scroll to top after a subcategory is selected (the homepage does). */
  scrollOnNavigate?: boolean
  /**
   * Category id from the current route, when browsing a category. Takes
   * precedence over the last-opened target so the link bar stays pointed at the
   * category being viewed.
   */
  routeCategoryId?: string
}

/**
 * Mega-menu state and handlers, shared by every page so the All categories
 * button, the mobile Categories tab and the menu behave identically everywhere.
 * Category links elsewhere (link bar, homepage tiles, footer) navigate directly
 * and do not go through this state.
 */
export function useCategoryNavigation(options?: UseCategoryNavigationOptions) {
  const { scrollOnNavigate = false, routeCategoryId } = options ?? {}
  const navigate = useNavigate()
  const { categories } = useCatalog()
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false)
  const [categoriesTargetId, setCategoriesTargetId] = useState<string>('featured')

  // The link bar highlights the major category, so a grouped member id (e.g.
  // "accessories" under "Fashion & Accessories") lights up its parent entry.
  const activeCategoryId = getMajorCategoryId(routeCategoryId ?? categoriesTargetId)

  const openCategories = useCallback((categoryId: string = 'featured') => {
    setCategoriesTargetId(categoryId)
    setIsCategoriesOpen(true)
  }, [])

  const toggleCategories = useCallback(() => {
    setIsCategoriesOpen((open) => {
      if (open) return false
      // Opens on the department being browsed, or the last one shown.
      setCategoriesTargetId(activeCategoryId)
      return true
    })
  }, [activeCategoryId])

  const closeCategories = useCallback(() => {
    setIsCategoriesOpen(false)
  }, [])

  const handleSubcategorySelect = useCallback(
    (selection: CategoryListingSelection) => {
      setIsCategoriesOpen(false)
      navigate(getCategoryPathFromSelection(selection, categories))
      if (scrollOnNavigate) {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    },
    [categories, navigate, scrollOnNavigate],
  )

  return {
    activeCategoryId,
    categoriesTargetId,
    closeCategories,
    handleSubcategorySelect,
    isCategoriesOpen,
    openCategories,
    toggleCategories,
  }
}
