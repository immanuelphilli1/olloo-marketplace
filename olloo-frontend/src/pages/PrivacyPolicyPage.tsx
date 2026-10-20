import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackToTopButton } from '../components/BackToTopButton'
import { Footer } from '../components/Footer'
import { Nav } from '../components/Nav'
import { useCategoryNavigation } from '../hooks/useCategoryNavigation'
import { PrivacyPolicyPageContent } from '../components/PrivacyPolicyPageContent'
import {
  getCartPath,
  getHomePath,
  getWishlistPath,
} from '../data/shopRoutes'

export function PrivacyPolicyPage() {
  const navigate = useNavigate()
  const {
    activeCategoryId,
    categoriesTargetId,
    closeCategories,
    handleSubcategorySelect,
    isCategoriesOpen,
    toggleCategories,
    toggleCategoriesFromLinkBar,
  } = useCategoryNavigation()

  const handleOpenCart = useCallback(() => {
    navigate(getCartPath())
  }, [navigate])

  const handleOpenWishlist = useCallback(() => {
    navigate(getWishlistPath())
  }, [navigate])

  const handleGoHome = useCallback(() => {
    navigate(getHomePath())
  }, [navigate])

  return (
    <>
      <Nav
        isCategoriesOpen={isCategoriesOpen}
        categoriesTargetId={categoriesTargetId}
        onToggleCategories={toggleCategories}
        onCloseCategories={closeCategories}
        onSubcategorySelect={handleSubcategorySelect}
        showCategoryLinksBar
        onOpenCategories={toggleCategoriesFromLinkBar}
        activeCategoryId={activeCategoryId}
        onOpenCart={handleOpenCart}
        onOpenWishlist={handleOpenWishlist}
        onAfterSignOut={handleGoHome}
        onMobileHome={handleGoHome}
      />
      <div className="mx-auto w-full min-w-0 max-w-360 overflow-x-clip bg-bg-primary">
        <PrivacyPolicyPageContent onGoHome={handleGoHome} />
        <Footer onOpenCategories={toggleCategoriesFromLinkBar} />
      </div>
      <BackToTopButton />
    </>
  )
}
