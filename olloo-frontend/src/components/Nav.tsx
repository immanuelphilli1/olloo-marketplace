import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { images } from '../assets/images'
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
import GlobalLineIcon from 'remixicon-react/GlobalLineIcon'
import HeartLineIcon from 'remixicon-react/HeartLineIcon'
import ListCheckLineIcon from 'remixicon-react/ListCheckIcon'
import UserLineIcon from 'remixicon-react/UserLineIcon'
import { NavSearchBar } from './NavSearchBar'
import type { CategoryListingSelection } from '../data/categoryListing'
import { getNavVideo, type SiteVideoPlacement } from '../api/services/catalog'
import { useAuth } from '../context/AuthContext'
import { useShop } from '../context/ShopContext'
import { BannerLink } from '../utils/bannerLink'

const navIconButton =
  'group flex cursor-pointer items-center justify-center rounded-full bg-bg-secondary transition-colors hover:bg-orange-light'
const navIcon =
  'text-text-secondary transition-colors group-hover:text-primary-orange'

/**
 * How far the page must scroll before the mobile header stops being transparent.
 *
 * A small threshold rather than `> 0`, because a few pixels of rubber-band
 * overscroll on iOS would otherwise flip the header to its solid state and back,
 * which reads as a flicker.
 */
const SCROLL_THRESHOLD_PX = 24

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
  onOpenCategories?: (categoryId: string, label: string) => void
  activeCategoryId?: string
  openToInitialCategory?: boolean
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
  onOpenCategories,
  activeCategoryId = 'featured',
  openToInitialCategory = false,
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

  // Only the landing page has a hero for the transparent mobile header to sit
  // over; elsewhere a transparent bar would float on plain white with a white
  // logo, so those routes always get the solid background.
  const isHomeRoute = location.pathname === '/'

  const handleSignOut = useCallback(async () => {
    await signOut()
    onAfterSignOut?.()
  }, [onAfterSignOut, signOut])
  const headerRef = useRef<HTMLElement>(null)
  const [headerHeight, setHeaderHeight] = useState(0)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
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

  // Only the mobile/tablet nav floats over the hero. Tailwind's `lg:hidden`
  // breakpoint hides the desktop nav at 1024px, so the media query matches the
  // same edge rather than relying on a separate hardcoded value.
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023.98px)')

    const syncViewport = () => setIsMobileViewport(mediaQuery.matches)
    syncViewport()
    mediaQuery.addEventListener('change', syncViewport)

    return () => mediaQuery.removeEventListener('change', syncViewport)
  }, [])

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > SCROLL_THRESHOLD_PX)

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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

  const categoriesButtonClass =
    'group flex h-12 w-44 shrink-0 cursor-pointer items-center gap-2 rounded-full p-4 transition-colors hover:bg-orange-light'

  /**
   * Mobile only: the header floats over the hero while the page is at the top
   * and gains its solid background once the user scrolls. Desktop is unaffected
   * because the banner strip above the nav already provides the backdrop.
   *
   * Other routes have no hero to sit over, so they stay solid throughout; letting
   * them go transparent would leave the white logo on a white page.
   */
  const isHeaderFloating = isMobileViewport && isHomeRoute && !isScrolled
  const mobileHeaderBackdropClass = isHeaderFloating ? 'bg-transparent' : 'bg-bg-primary'

  return (
    <>
      <header
        ref={headerRef}
        className={`fixed inset-x-0 top-0 z-50 w-full max-w-[100vw] overflow-x-clip transition-colors duration-300 lg:bg-bg-primary ${mobileHeaderBackdropClass}`}
      >
        <div
          className={`relative mx-auto w-full min-w-0 max-w-full transition-colors duration-300 ${
            // While floating, the border would draw a hard line straight across
            // the hero image, so it is only shown once the header is solid.
            isHeaderFloating ? 'border-b border-transparent' : 'border-b border-border-primary'
          }`}
        >
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

          {/* Desktop navigation */}
          <div className="hidden max-w-400 mx-auto items-center gap-4 px-16 py-4 lg:flex">
            <Link to="/" aria-label="Home" className="shrink-0 cursor-pointer" onClick={openHome}>
              <img alt="H&CO." className="h-7 w-29.25" src={images.nav.logo} />
            </Link>

            <button
              type="button"
              onClick={toggleCategories}
              aria-expanded={isCategoriesOpen}
              className={`${categoriesButtonClass} ${
                isCategoriesOpen ? 'bg-orange-light' : 'bg-bg-secondary'
              }`}
            >
              <ListCheckLineIcon
                className={`size-6 shrink-0 transition-colors ${
                  isCategoriesOpen
                    ? 'text-primary-orange'
                    : 'text-text-secondary group-hover:text-primary-orange'
                }`}
                aria-hidden
              />
              <span
                className={`flex-1 text-left text-base font-medium tracking-[-0.32px] transition-colors ${
                  isCategoriesOpen
                    ? 'text-primary-orange'
                    : 'text-text-secondary group-hover:text-primary-orange'
                }`}
              >
                Categories
              </span>
            </button>

            <NavSearchBar
              variant="desktop"
              inputClassName=""
              buttonClassName="btn-orange group flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full py-4 pl-4 pr-6 transition-opacity hover:opacity-90"
              buttonLabelClassName="text-sm font-medium tracking-[-0.28px] text-text-inverse"
              onSearchSubmit={onCloseCategories}
            />

            <div className="flex shrink-0 items-center gap-4">
              <button
                type="button"
                className={`${navIconButton} size-12 px-3`}
                aria-label="Language"
              >
                <GlobalLineIcon className={`size-6 ${navIcon}`} aria-hidden />
              </button>

              <button
                type="button"
                onClick={openWishlist}
                className={`${navIconButton} size-12 px-3`}
                aria-label="Wishlist"
              >
                <HeartLineIcon className={`size-6 ${navIcon}`} aria-hidden />
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={openCart}
                  className={`${navIconButton} size-12 px-3`}
                  aria-label="Cart"
                >
                  <svg
                    className={`size-6 ${navIcon}`}
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                  >
                    <use href={`${images.nav.cart}#Vector`} fill="currentColor" />
                  </svg>
                </button>
                <span className="btn-orange absolute -right-2.5 -top-1.5 flex size-6 min-w-6 items-center justify-center rounded-full border border-white px-1 text-xs font-medium tracking-[-0.24px] text-text-inverse">
                  {cartItemCount}
                </span>
              </div>

              <div ref={desktopAccountRef} className="relative">
                <button
                  type="button"
                  onClick={handleAccountClick}
                  aria-expanded={isSignedIn ? isAccountMenuOpen : undefined}
                  aria-haspopup={isSignedIn ? 'menu' : undefined}
                  className={`group ${navIconButton} h-12 gap-2 py-4 ${
                    isSignedIn ? 'pl-5 pr-7' : 'size-12 px-3'
                  } ${isSignedIn && isAccountMenuOpen ? 'bg-orange-light' : ''}`}
                  aria-label={isSignedIn ? 'Account' : 'Sign in'}
                >
                  <UserLineIcon
                    className={`size-6 transition-colors ${
                      isSignedIn && isAccountMenuOpen
                        ? 'text-primary-orange'
                        : `${navIcon} group-hover:text-primary-orange`
                    }`}
                    aria-hidden
                  />
                  {isSignedIn ? (
                    <span
                      className={`text-base font-medium tracking-[-0.32px] transition-colors ${
                        isAccountMenuOpen
                          ? 'text-primary-orange'
                          : 'text-text-primary group-hover:text-primary-orange'
                      }`}
                    >
                      {userDisplayName}
                    </span>
                  ) : null}
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
            </div>
          </div>

          {/* Mobile navigation. While the header is transparent the logo and search icon
              sit directly on the hero image, so both are forced to white and the
              logo uses a filter because `logo-primary.svg` is a dark-fill asset
              that CSS cannot recolour. */}
          <div className="flex flex-col gap-2 p-4 lg:hidden">
            <div className="flex items-center gap-4">
              <Link to="/" aria-label="Home" className="shrink-0" onClick={() => onMobileHome?.()}>
                <img
                  alt="H&CO."
                  className={`h-6 w-25 transition-[filter] duration-300 ${
                    isHeaderFloating ? 'brightness-0 invert' : ''
                  }`}
                  src={images.nav.logo}
                />
              </Link>

              <NavSearchBar
                variant="mobile"
                inputClassName="text-sm"
                buttonClassName="btn-orange flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-opacity hover:opacity-90"
                buttonLabelClassName=""
                onSearchSubmit={onCloseCategories}
                collapsedIconClassName={
                  isHeaderFloating ? 'text-text-inverse' : 'text-text-secondary'
                }
              />
            </div>
          </div>
        </div>

        {showCategoryLinksBar && onOpenCategories ? (
          <CategoryLinksBar
            onOpenCategories={onOpenCategories}
            activeCategoryId={activeCategoryId}
            isCategoriesOpen={isCategoriesOpen}
          />
        ) : null}

        <CategoriesModal
          isOpen={isCategoriesOpen}
          initialCategoryId={categoriesTargetId}
          openToInitialCategory={openToInitialCategory}
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

      {/*
        Reserves the header's height so page content clears the fixed bar.

        On mobile the header is transparent at the top of the page and is meant
        to float over the hero, so the spacer is dropped there and the hero
        slides up underneath it. Once the user scrolls the header gains its solid
        background, so the spacer comes back and the content below the hero is
        still pushed clear of the bar.
      */}
      <div
        aria-hidden
        className="shrink-0"
        style={{
          height: isHeaderFloating ? 0 : headerHeight,
        }}
      />

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
