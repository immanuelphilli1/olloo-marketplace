import { CategoryGridSection } from './CategoryGridSection'
import { FeaturedItemsSection } from './FeaturedItemsSection'
import { Footer } from './Footer'
import { HeroSection } from './HeroSection'
import { HomePageLogoLoader } from './HomePageLogoLoader'
import { NewArrivalsSection } from './NewArrivalsSection'
import { PromoBannerSection } from './PromoBannerSection'
import { useCatalog } from '../context/CatalogContext'
import { useHomePlacements } from '../context/HomePlacementsContext'
import type { SidebarCategoryId } from '../data/categoriesModal'
import type { Product } from '../data/products'

type HomeLandingProps = {
  onOpenCategories: (categoryId: SidebarCategoryId | string, label?: string) => void
  onNewArrivalProductSelect: (product: Product) => void
  onFeaturedProductSelect: (product: Product) => void
  onShopAllCategories: () => void
}

export function HomeLanding({
  onOpenCategories,
  onNewArrivalProductSelect,
  onFeaturedProductSelect,
  onShopAllCategories,
}: HomeLandingProps) {
  const { isReady: isCatalogReady } = useCatalog()
  const { isLoading: isPlacementsLoading } = useHomePlacements()

  if (!isCatalogReady || isPlacementsLoading) {
    return <HomePageLogoLoader />
  }

  return (
    <>
      <main>
        <HeroSection />
        <CategoryGridSection onOpenCategories={onOpenCategories} />
        <NewArrivalsSection onProductSelect={onNewArrivalProductSelect} />
        <FeaturedItemsSection onProductSelect={onFeaturedProductSelect} />
        <PromoBannerSection onShopAllCategories={onShopAllCategories} />
      </main>
      <Footer onOpenCategories={onOpenCategories} />
    </>
  )
}
