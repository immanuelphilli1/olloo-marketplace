import { useCallback, useEffect, useMemo } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BackToTopButton } from '../components/BackToTopButton'
import { Footer } from '../components/Footer'
import { Nav } from '../components/Nav'
import { YourOrdersView } from '../components/YourOrdersView'
import { useCategoryNavigation } from '../hooks/useCategoryNavigation'
import {
  getAccountPath,
  parseAccountSection,
  wantsDefaultAddressEdit,
  wantsResidenceAddressAdd,
  type AccountSection,
} from '../data/accountRoutes'
import {
  getCartPath,
  getHomePath,
  getWishlistPath,
} from '../data/shopRoutes'

export function AccountPage() {
  const { section: sectionParam } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const section = parseAccountSection(sectionParam)

  // Checkout's "Edit" link appends this flag so the addresses panel opens its
  // edit form on arrival.
  const startEditingDefaultAddress = useMemo(
    () => section === 'addresses' && wantsDefaultAddressEdit(searchParams.toString()),
    [searchParams, section],
  )

  const startAddingResidenceAddress = useMemo(
    () => section === 'addresses' && wantsResidenceAddressAdd(searchParams.toString()),
    [searchParams, section],
  )

  /** Drops the flag once the form is dismissed, so it does not reopen. */
  const handleDismissEditIntent = useCallback(() => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('edit')
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  const handleDismissResidenceAddIntent = useCallback(() => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('add')
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  useEffect(() => {
    if (sectionParam && !section) {
      navigate(getAccountPath('orders'), { replace: true })
    }
  }, [navigate, section, sectionParam])

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

  const handleViewRefundPolicy = useCallback(() => {
    navigate('/return-refund')
  }, [navigate])

  const handleSectionChange = useCallback(
    (nextSection: AccountSection) => {
      navigate(getAccountPath(nextSection))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [navigate],
  )

  if (!section) {
    return <Navigate to={getAccountPath('orders')} replace />
  }

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
        mobileActiveTab="account"
        onMobileHome={handleGoHome}
      />
      <div className="mx-auto w-full min-w-0 max-w-360 overflow-x-clip bg-bg-primary">
        <main>
          <YourOrdersView
            section={section}
            onGoHome={handleGoHome}
            onSectionChange={handleSectionChange}
            onViewRefundPolicy={handleViewRefundPolicy}
            startEditingDefaultAddress={startEditingDefaultAddress}
            onDismissEditIntent={handleDismissEditIntent}
            startAddingResidenceAddress={startAddingResidenceAddress}
            onDismissResidenceAddIntent={handleDismissResidenceAddIntent}
          />
        </main>
        <Footer onOpenCategories={toggleCategoriesFromLinkBar} />
      </div>
      <BackToTopButton />
    </>
  )
}
