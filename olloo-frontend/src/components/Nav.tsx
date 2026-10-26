import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AccountMenu } from './AccountMenu'
import { CategoriesModal } from './CategoriesModal'
import { CategoryLinksBar } from './CategoryLinksBar'
import { MobileAccountMenu } from './MobileAccountMenu'
import { MobileAppNavigation, type MobileNavTab } from './MobileAppNavigation'
import { SignInModal } from './SignInModal'
import {
  getAccountPath,
  parseAccountSection,
  type AccountSection,
} from '../data/accountRoutes'
import ArrowDownSLineIcon from 'remixicon-react/ArrowDownSLineIcon'
import HeartLineIcon from 'remixicon-react/HeartLineIcon'
import LayoutGridLineIcon from 'remixicon-react/LayoutGridLineIcon'
import SecurePaymentLineIcon from 'remixicon-react/SecurePaymentLineIcon'
import ShoppingCart2LineIcon from 'remixicon-react/ShoppingCart2LineIcon'
import TruckLineIcon from 'remixicon-react/TruckLineIcon'
import UserLineIcon from 'remixicon-react/UserLineIcon'
import { NavSearchBar } from './NavSearchBar'
import { OllooLogo } from './OllooLogo'
import type { CategoryListingSelection } from '../data/categoryListing'
import { getNavVideo, type SiteVideoPlacement } from '../api/services/catalog'
import { useAuth } from '../context/AuthContext'
import { useShop } from '../context/ShopContext'
import { BannerLink } from '../utils/bannerLink'

/** Header actions: an icon with an optional two-line label, Amazon/Jumia style. */
const navActionButton =
  'group flex h-12 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3 transition-colors hover:bg-brand-light'
const navActionIcon = 'size-6 shrink-0 text-text-primary transition-colors group-hover:text-brand'

/** Policy pages surfaced in the utility bar, so its promises link to the terms behind them. */
const utilityLinks = [
  { label: 'Delivery', to: '/shipping-delivery' },
  { label: 'Returns & refunds', to: '/return-refund' },
  { label: 'About olloo', to: '/about' },
]

type NavProps = {
  isCategoriesOpen: boolean
  categoriesTargetId: string
  onToggleCategories: () => void
  onCloseCategories: () => void
  onSubcategorySelect: (selection: CategoryListingSelection) => void
  onOpenCart?: () => void
  onOpenWishlist?: () => void
  onAfterSignOut?: () => void
  mobileActiveTab?: MobileNavTab
  onMobileHome?: () => void
  showCategoryLinksBar?: boolean
}

export function Nav({
  isCategoriesOpen,
  categoriesTargetId,
  onToggleCategories,
  onCloseCategories,
  onSubcategorySelect,
  onOpenCart,
  onOpenWishlist,
  onAfterSignOut,
  mobileActiveTab = 'home',
  onMobileHome,
  showCategoryLinksBar = false,
}: NavProps) {
  const { authUser, signOut, signInRequestCount } = useAuth()
  const { cartItemCount } = useShop()
  const isSignedIn = authUser !== null
  const userDisplayName = authUser?.displayName ?? 'Guest'
  const userFullName = authUser?.fullName ?? 'Guest'
  const navigate = useNavigate()
  const location = useLocation()

  // Highlights the current page's entry in the mobile account sheet.
  const accountSectionFromPath = useMemo(
    () => parseAccountSection(location.pathname.split('/')[2]),
    [location.pathname],
  )

  const handleSignOut = useCallback(async () => {
    await signOut()
    onAfterSignOut?.()
  }, [onAfterSignOut, signOut])
  const headerRef = useRef<HTMLElement>(null)
  const [headerHeight, setHeaderHeight] = useState(0)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [isMobileAccountMenuOpen, setIsMobileAccountMenuOpen] = useState(false)
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false)
  const desktopAccountRef = useRef<HTMLDivElement>(null)

  const [navVideo, setNavVideo] = useState<SiteVideoPlacement | null>(null)
  const [isNavVideoLoaded, setIsNavVideoLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    getNavVideo()
      .then((video) => {
        if (!cancelled) setNavVideo(video)
      })
      .catch(() => {
        if (!cancelled) setNavVideo(null)
      })
      .finally(() => {
        if (!cancelled) setIsNavVideoLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const bannerVideoRef = useCallback((video: HTMLVideoElement | null) => {
    if (!video) return
    video.muted = true
    video.defaultMuted = true
    video.setAttribute('muted', '')
    video.play().catch(() => {
      const retry = () => {
        video.play().catch(() => {})
        window.removeEventListener('pointerdown', retry)
      }
      window.addEventListener('pointerdown', retry, { once: true })
    })
  }, [])

  const closeAccountMenu = useCallback(() => setIsAccountMenuOpen(false), [])
  const closeMobileAccountMenu = useCallback(() => setIsMobileAccountMenuOpen(false), [])

  const openAccountSection = useCallback(
    (section: AccountSection) => {
      closeAccountMenu()
      closeMobileAccountMenu()
      navigate(getAccountPath(section))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [closeAccountMenu, closeMobileAccountMenu, navigate],
  )

  const toggleCategories = () => {
    onToggleCategories()
    setIsAccountMenuOpen(false)
  }

  const toggleAccountMenu = () => {
    setIsAccountMenuOpen((open) => !open)
    onCloseCategories()
  }

  const handleAccountClick = () => {
    onCloseCategories()
    if (isSignedIn) {
      toggleAccountMenu()
      return
    }
    closeAccountMenu()
    setIsSignInModalOpen(true)
  }

  const openCart = () => {
    closeAccountMenu()
    onCloseCategories()
    onOpenCart?.()
  }

  const openHome = () => {
    closeAccountMenu()
    onCloseCategories()
    setIsSignInModalOpen(false)
    navigate('/')
    onMobileHome?.()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openWishlist = () => {
    closeAccountMenu()
    onCloseCategories()
    setIsSignInModalOpen(false)
    onOpenWishlist?.()
  }

  const handleMobileHome = () => {
    closeAccountMenu()
    onCloseCategories()
    setIsSignInModalOpen(false)
    navigate('/')
    onMobileHome?.()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleMobileAccount = () => {
    onCloseCategories()
    // Signed in: open the account sheet listing every section, the same way the
    // Categories tab opens its panel, instead of dropping straight into orders.
    if (isSignedIn) {
      setIsMobileAccountMenuOpen(true)
      return
    }
    setIsSignInModalOpen(true)
  }

  useEffect(() => {
    if (isCategoriesOpen) {
      closeAccountMenu()
      closeMobileAccountMenu()
      setIsSignInModalOpen(false)
    }
  }, [closeAccountMenu, closeMobileAccountMenu, isCategoriesOpen])

  // A sign-in gated action (e.g. the wishlist heart) was triggered while signed
  // out, so surface the sign-in modal the same way the Account button does.
  useEffect(() => {
    if (signInRequestCount === 0 || isSignedIn) return

    closeAccountMenu()
    setIsSignInModalOpen(true)
  }, [closeAccountMenu, isSignedIn, signInRequestCount])

  useEffect(() => {
    const header = headerRef.current
    if (!header) return

    const updateHeight = () => {
      setHeaderHeight(header.offsetHeight)
      document.documentElement.style.setProperty('--nav-height', `${header.offsetHeight}px`)
    }
    updateHeight()

    const observer = new ResizeObserver(updateHeight)
    observer.observe(header)

    return () => observer.disconnect()
  }, [isCategoriesOpen, isAccountMenuOpen])

  useEffect(() => {
    if (!isAccountMenuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return

      if (!desktopAccountRef.current?.contains(target)) closeAccountMenu()
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [closeAccountMenu, isAccountMenuOpen])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    const handleViewportChange = () => closeAccountMenu()

    mediaQuery.addEventListener('change', handleViewportChange)

    return () => mediaQuery.removeEventListener('change', handleViewportChange)
  }, [closeAccountMenu])

  return (
    <>
      <header
        ref={headerRef}
        className="fixed inset-x-0 top-0 z-50 w-full max-w-[100vw] overflow-x-clip bg-bg-primary"
      >
        <div className="relative mx-auto w-full min-w-0 max-w-full border-b border-border-primary">
          {(!isNavVideoLoaded || navVideo) && (
            <div className="relative hidden h-10 overflow-hidden lg:block lg:h-12">
              {navVideo && (
                <BannerLink linkUrl={navVideo.linkUrl} className="block size-full">
                  <video
                    key={navVideo.videoUrl}
                    ref={bannerVideoRef}
                    className="size-full object-cover"
                    src={navVideo.videoUrl ?? undefined}
                    poster={navVideo.imageUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    aria-label={navVideo.altText ?? 'Advertisement'}
                  />
                </BannerLink>
              )}
            </div>
          )}

          {/* Desktop utility bar: shopper reassurance on the left, the policies
              that back it on the right. */}
          <div className="hidden bg-ink text-text-inverse lg:block">
            <div className="mx-auto flex h-9 max-w-400 items-center gap-6 px-16 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-text-inverse/85">
                <SecurePaymentLineIcon className="size-4 text-accent" aria-hidden />
                Secure payments on every order
              </span>
              <span className="flex items-center gap-1.5 text-text-inverse/85">
                <TruckLineIcon className="size-4 text-accent" aria-hidden />
                Track every delivery to your door
              </span>
              <nav aria-label="Help" className="ml-auto flex items-center gap-5">
                {utilityLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="text-text-inverse/75 transition-colors hover:text-text-inverse"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>

          {/* Desktop navigation */}
          <div className="mx-auto hidden max-w-400 items-center gap-5 px-16 py-3.5 lg:flex">
            <Link to="/" aria-label="olloo home" className="shrink-0 cursor-pointer" onClick={openHome}>
              <OllooLogo className="h-8 w-auto text-brand" />
            </Link>

            <button
              type="button"
              onClick={toggleCategories}
              aria-expanded={isCategoriesOpen}
              className={`group flex h-12 shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 transition-colors ${
                isCategoriesOpen
                  ? 'bg-brand text-text-inverse'
                  : 'bg-brand-light text-brand hover:bg-brand hover:text-text-inverse'
              }`}
            >
              <LayoutGridLineIcon className="size-5 shrink-0" aria-hidden />
              <span className="text-sm font-bold">All categories</span>
              <ArrowDownSLineIcon
                className={`size-4 shrink-0 transition-transform ${isCategoriesOpen ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>

            <NavSearchBar
              variant="desktop"
              inputClassName=""
              buttonClassName="btn-brand group flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full pl-4 pr-5 transition-opacity hover:opacity-90"
              buttonLabelClassName="text-sm font-bold text-text-inverse"
              placeholder="Search products, brands and categories"
              onSearchSubmit={onCloseCategories}
            />

            <div className="flex shrink-0 items-center gap-1">
              <div ref={desktopAccountRef} className="relative">
                <button
                  type="button"
                  onClick={handleAccountClick}
                  aria-expanded={isSignedIn ? isAccountMenuOpen : undefined}
                  aria-haspopup={isSignedIn ? 'menu' : undefined}
                  className={`${navActionButton} ${isSignedIn && isAccountMenuOpen ? 'bg-brand-light' : ''}`}
                  aria-label={isSignedIn ? 'Account' : 'Sign in'}
                >
                  <UserLineIcon
                    className={`${navActionIcon} ${isSignedIn && isAccountMenuOpen ? 'text-brand' : ''}`}
                    aria-hidden
                  />
                  <span className="flex flex-col items-start text-left leading-tight">
                    <span className="text-[11px] font-medium text-text-tertiary">
                      {isSignedIn ? `Hi, ${userDisplayName}` : 'Welcome'}
                    </span>
                    <span className="text-sm font-bold text-text-primary group-hover:text-brand">
                      {isSignedIn ? 'Account & orders' : 'Sign in / Register'}
                    </span>
                  </span>
                </button>
                {isSignedIn ? (
                  <AccountMenu
                    isOpen={isAccountMenuOpen}
                    userFullName={userFullName}
                    onClose={closeAccountMenu}
                    onSignOut={() => void handleSignOut()}
                    onYourOrdersClick={() => openAccountSection('orders')}
                    onYourReviewsClick={() => openAccountSection('reviews')}
                    onYourProfileClick={() => openAccountSection('profile')}
                    onBrowsingHistoryClick={() => openAccountSection('history')}
                    onAddressesClick={() => openAccountSection('addresses')}
                    onPaymentMethodsClick={() => openAccountSection('payments')}
                    onNotificationsClick={() => openAccountSection('notifications')}
                  />
                ) : null}
              </div>

              <button
                type="button"
                onClick={openWishlist}
                className={`${navActionButton} w-12 justify-center px-0`}
                aria-label="Wishlist"
              >
                <HeartLineIcon className={navActionIcon} aria-hidden />
              </button>

              <button type="button" onClick={openCart} className={navActionButton} aria-label="Cart">
                <span className="relative">
                  <ShoppingCart2LineIcon className={navActionIcon} aria-hidden />
                  <span className="absolute -right-2.5 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-bg-primary bg-accent px-1 text-[11px] font-extrabold leading-none text-accent-ink">
                    {cartItemCount}
                  </span>
                </span>
                <span className="text-sm font-bold text-text-primary group-hover:text-brand">Cart</span>
              </button>
            </div>
          </div>

          {/* Mobile navigation: logo row, then a search field that is always
              open, because search is how most shoppers start on a phone. */}
          <div className="flex flex-col gap-2.5 px-4 pb-3 pt-3 lg:hidden">
            <div className="flex items-center justify-between gap-4">
              <Link to="/" aria-label="olloo home" className="shrink-0" onClick={() => onMobileHome?.()}>
                <OllooLogo className="h-6.5 w-auto text-brand" />
              </Link>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-text-secondary">
                <SecurePaymentLineIcon className="size-4 text-primary-green" aria-hidden />
                Secure checkout
              </span>
            </div>

            {/* The desktop variant is the always-open field; the mobile variant
                collapses behind an icon, which this layout no longer needs. */}
            <NavSearchBar
              variant="desktop"
              inputClassName="text-sm"
              buttonClassName="btn-brand flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-opacity hover:opacity-90"
              buttonLabelClassName=""
              placeholder="Search on olloo"
              onSearchSubmit={onCloseCategories}
            />
          </div>
        </div>

        {showCategoryLinksBar ? <CategoryLinksBar onNavigate={onCloseCategories} /> : null}

        <CategoriesModal
          isOpen={isCategoriesOpen}
          initialCategoryId={categoriesTargetId}
          onClose={onCloseCategories}
          onSubcategorySelect={onSubcategorySelect}
        />

        <SignInModal
          isOpen={isSignInModalOpen}
          onClose={() => setIsSignInModalOpen(false)}
        />

        <MobileAccountMenu
          isOpen={isMobileAccountMenuOpen}
          userFullName={userFullName}
          userEmail={authUser?.email ?? ''}
          activeSection={accountSectionFromPath ?? 'orders'}
          onClose={closeMobileAccountMenu}
          onSectionSelect={openAccountSection}
          onSignOut={() => void handleSignOut()}
        />
      </header>

      {/* Reserves the header's height so page content clears the fixed bar. */}
      <div aria-hidden className="shrink-0" style={{ height: headerHeight }} />

      <MobileAppNavigation
        activeTab={isCategoriesOpen ? 'categories' : mobileActiveTab}
        onHome={handleMobileHome}
        onCategories={toggleCategories}
        onFavourite={openWishlist}
        onCart={openCart}
        onAccount={handleMobileAccount}
        cartItemCount={cartItemCount}
        accountLabel={isSignedIn ? userDisplayName : undefined}
      />

      {/* <div aria-hidden className="shrink-0 lg:hidden" style={{ height: '72px' }} /> */}
    </>
  )
}
