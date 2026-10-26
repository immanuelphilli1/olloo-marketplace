import { CategoryGridSection } from './CategoryGridSection'
import { DealsSection } from './DealsSection'
import { FeaturedItemsSection } from './FeaturedItemsSection'
import { FeaturesSection } from './FeaturesSection'
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
      <main className="flex flex-col gap-7 pb-10 lg:gap-12 lg:pb-16">
        <div className="flex flex-col gap-4 lg:gap-5">
          <HeroSection
            onShopAll={onShopAllCategories}
            onBrowseCategories={() => onOpenCategories('featured')}
          />
          <FeaturesSection />
        </div>
        <CategoryGridSection onShopAll={onShopAllCategories} />
        <DealsSection
          onProductSelect={onFeaturedProductSelect}
          onShopAll={onShopAllCategories}
        />
        <NewArrivalsSection onProductSelect={onNewArrivalProductSelect} />
        <PromoBannerSection onShopAllCategories={onShopAllCategories} />
        <FeaturedItemsSection onProductSelect={onFeaturedProductSelect} />
      </main>
      <Footer />
    </>
  )
}
