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
 * Category modal state and handlers, shared by every page so the Categories
 * button, the link bar and the modal behave identically everywhere.
 */
export function useCategoryNavigation(options?: UseCategoryNavigationOptions) {
  const { scrollOnNavigate = false, routeCategoryId } = options ?? {}
  const navigate = useNavigate()
  const { categories } = useCatalog()
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false)
  const [categoriesTargetId, setCategoriesTargetId] = useState<string>('featured')
  // Whether the current open was triggered by a deliberate category pick (the
  // link bar) rather than the generic Categories button / mobile tab. Only a
  // deliberate pick should jump straight to that category on mobile.
  const [openToInitialCategory, setOpenToInitialCategory] = useState(false)

  // The link bar highlights the major category, so a grouped member id (e.g.
  // "accessories" under "Fashion & Accessories") lights up its parent entry.
  const activeCategoryId = getMajorCategoryId(routeCategoryId ?? categoriesTargetId)

  const openCategories = useCallback((categoryId: string = 'featured') => {
    setCategoriesTargetId(categoryId)
    setOpenToInitialCategory(true)
    setIsCategoriesOpen(true)
  }, [])

  // Link bar entries toggle: clicking the category already showing closes the
  // modal, so the panel can be dismissed without hunting for the Categories
  // button. Compared on the major category so that, for example,
  // "Fashion & Accessories" also closes a panel opened for Accessories.
  const toggleCategoriesFromLinkBar = useCallback(
    (categoryId: string = 'featured') => {
      setIsCategoriesOpen((open) => {
        if (open && getMajorCategoryId(categoriesTargetId) === getMajorCategoryId(categoryId)) {
          return false
        }

        setCategoriesTargetId(categoryId)
        setOpenToInitialCategory(true)
        return true
      })
    },
    [categoriesTargetId],
  )

  const toggleCategories = useCallback(() => {
    setIsCategoriesOpen((open) => {
      if (open) return false
      setCategoriesTargetId(activeCategoryId)
      // Generic entry point: on mobile, show the category list rather than
      // reopening whichever category happened to be active last.
      setOpenToInitialCategory(false)
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
    openToInitialCategory,
    toggleCategories,
    toggleCategoriesFromLinkBar,
  }
}
