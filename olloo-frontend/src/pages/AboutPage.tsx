import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AboutPageContent } from '../components/AboutPageContent'
import { BackToTopButton } from '../components/BackToTopButton'
import { Footer } from '../components/Footer'
import { Nav } from '../components/Nav'
import { useCategoryNavigation } from '../hooks/useCategoryNavigation'
import {
  getCartPath,
  getHomePath,
  getProductPath,
  getWishlistPath,
} from '../data/shopRoutes'
import type { Product } from '../data/products'

export function AboutPage() {
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

  const handleProductSelect = useCallback(
    (product: Product) => {
      navigate(getProductPath(product.id, { from: 'home' }))
    },
    [navigate],
  )

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
        <AboutPageContent
          onGoHome={handleGoHome}
          onProductSelect={handleProductSelect}
        />
        <Footer onOpenCategories={toggleCategoriesFromLinkBar} />
      </div>
      <BackToTopButton />
    </>
  )
}
