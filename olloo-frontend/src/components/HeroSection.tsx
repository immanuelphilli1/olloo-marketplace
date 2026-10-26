import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ArrowLeftSLineIcon from 'remixicon-react/ArrowLeftSLineIcon'
import ArrowRightLineIcon from 'remixicon-react/ArrowRightLineIcon'
import ArrowRightSLineIcon from 'remixicon-react/ArrowRightSLineIcon'
import FileList3LineIcon from 'remixicon-react/FileList3LineIcon'
import FireFillIcon from 'remixicon-react/FireFillIcon'
import HeartLineIcon from 'remixicon-react/HeartLineIcon'
import MapPin2LineIcon from 'remixicon-react/MapPin2LineIcon'
import { CarouselDots } from './CarouselDots'
import { OllooMark } from './OllooLogo'
import { useAuth } from '../context/AuthContext'
import { useCatalog } from '../context/CatalogContext'
import { useHomePlacements } from '../context/HomePlacementsContext'
import { getAccountPath } from '../data/accountRoutes'
import { splitDisplayPrice } from '../data/format'
import type { Product } from '../data/products'
import { getProductPath, getWishlistPath } from '../data/shopRoutes'
import { BannerLink } from '../utils/bannerLink'

const heroArrowButton =
  'group flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-bg-primary/90 shadow-float backdrop-blur transition-[opacity,background-color] hover:bg-bg-primary lg:opacity-0 lg:group-hover/hero:opacity-100'
const heroArrowIcon = 'size-5 text-text-primary'

const AUTO_PLAY_INTERVAL_MS = 5000

type HeroSectionProps = {
  /** Opens the full catalogue listing. */
  onShopAll: () => void
  /** Opens the categories panel. */
  onBrowseCategories: () => void
}

/** Highest-discount in-stock products first; the hero and its side card share this. */
function useTopDeals(limit: number): Product[] {
  const { allProducts } = useCatalog()

  return useMemo(
    () =>
      allProducts
        .filter((product) => product.discountPercent && product.inStock !== false)
        .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0))
        .slice(0, limit),
    [allProducts, limit],
  )
}

export function HeroSection({ onShopAll, onBrowseCategories }: HeroSectionProps) {
  const { hero: bannerSlides } = useHomePlacements()

  return (
    <section className="px-4 pt-3 lg:px-16 lg:pt-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_330px]">
        {bannerSlides.length > 0 ? (
          <BannerCarousel />
        ) : (
          <BrandHero onShopAll={onShopAll} onBrowseCategories={onBrowseCategories} />
        )}

        <aside className="hidden flex-col gap-4 lg:flex">
          <WelcomeCard />
          <TopDealCard />
        </aside>
      </div>
    </section>
  )
}

/** Staff-managed banners (admin Banners, `home.hero`). */
function BannerCarousel() {
  const { hero: bannerSlides } = useHomePlacements()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    setCurrentSlide(0)
  }, [bannerSlides.length])

  const showPreviousSlide = () => {
    setCurrentSlide((slide) => (slide - 1 + bannerSlides.length) % bannerSlides.length)
  }

  const showNextSlide = () => {
    setCurrentSlide((slide) => (slide + 1) % bannerSlides.length)
  }

  useEffect(() => {
    if (isPaused || bannerSlides.length <= 1) return

    const intervalId = window.setInterval(() => {
      setCurrentSlide((slide) => (slide + 1) % bannerSlides.length)
    }, AUTO_PLAY_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [bannerSlides.length, isPaused])

  return (
    <div
      className="group/hero relative h-44 overflow-hidden rounded-card bg-bg-secondary sm:h-64 lg:h-full lg:min-h-[400px]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {bannerSlides.map((slide, index) => {
        const image = (
          <img
            alt={slide.altText}
            aria-hidden={index !== currentSlide}
            className={`absolute inset-0 size-full object-cover transition-opacity duration-700 ${
              index === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
            src={slide.imageUrl}
          />
        )

        return slide.linkUrl ? (
          <BannerLink key={slide.rid} linkUrl={slide.linkUrl} className="absolute inset-0 block">
            {image}
          </BannerLink>
        ) : (
          <div key={slide.rid} className="absolute inset-0">
            {image}
          </div>
        )
      })}

      {bannerSlides.length > 1 ? (
        <>
          <div className="pointer-events-none absolute inset-0 hidden items-center justify-between px-5 lg:flex">
            <button
              type="button"
              onClick={showPreviousSlide}
              className={`pointer-events-auto ${heroArrowButton}`}
              aria-label="Previous slide"
            >
              <ArrowLeftSLineIcon className={heroArrowIcon} aria-hidden />
            </button>
            <button
              type="button"
              onClick={showNextSlide}
              className={`pointer-events-auto ${heroArrowButton}`}
              aria-label="Next slide"
            >
              <ArrowRightSLineIcon className={heroArrowIcon} aria-hidden />
            </button>
          </div>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-glass p-1 backdrop-blur lg:bottom-4 lg:p-1.5">
            <CarouselDots
              count={bannerSlides.length}
              activeIndex={currentSlide}
              onSelect={setCurrentSlide}
              className="gap-1.5 px-0 py-0 lg:gap-2 lg:px-0 lg:py-0"
            />
          </div>
        </>
      ) : null}
    </div>
  )
}

/**
 * Default hero when staff have not published any banners yet, so the landing
 * page always opens on something. Built from live catalogue products rather
 * than stock art, so it never advertises an item the shop does not sell.
 */
function BrandHero({ onShopAll, onBrowseCategories }: HeroSectionProps) {
  const { featuredProducts } = useCatalog()
  const deals = useTopDeals(3)
  const showcase = (deals.length >= 3 ? deals : featuredProducts).slice(0, 3)

  return (
    <div className="relative isolate overflow-hidden rounded-card bg-ink px-5 py-6 text-text-inverse sm:px-8 sm:py-9 lg:min-h-[400px] lg:px-12 lg:py-12">
      {/* Soft brand glows behind the copy; purely decorative. */}
      <div
        aria-hidden
        className="absolute -left-24 -top-32 -z-10 size-[420px] rounded-full bg-brand opacity-60 blur-[90px]"
      />
      <div
        aria-hidden
        className="absolute -bottom-40 right-10 -z-10 size-[360px] rounded-full bg-[#8b5cf6] opacity-40 blur-[100px]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.07] [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:22px_22px]"
      />

      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="flex max-w-xl flex-col items-start gap-4 lg:gap-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-text-inverse/10 px-3 py-1 text-xs font-semibold text-text-inverse ring-1 ring-text-inverse/15">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden />
            Welcome to olloo
          </span>
          <h1 className="font-display text-[28px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-4xl lg:text-[52px]">
            Everything you love,{' '}
            <span className="relative whitespace-nowrap text-accent">one tap away.</span>
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-text-inverse/75 lg:text-base">
            Electronics, fashion, home and more from trusted brands, with secure checkout and
            every delivery tracked to your door.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onShopAll}
              className="group flex h-11 cursor-pointer items-center gap-2 rounded-full bg-accent px-5 text-sm font-bold text-accent-ink transition-transform hover:-translate-y-px lg:h-12 lg:px-6"
            >
              Start shopping
              <ArrowRightLineIcon
                className="size-4.5 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </button>
            <button
              type="button"
              onClick={onBrowseCategories}
              className="flex h-11 cursor-pointer items-center rounded-full px-5 text-sm font-bold text-text-inverse ring-1 ring-text-inverse/30 transition-colors hover:bg-text-inverse/10 lg:h-12 lg:px-6"
            >
              Browse categories
            </button>
          </div>
        </div>

        {showcase.length > 0 ? (
          <div className="relative hidden h-[300px] sm:block lg:h-[320px]">
            {showcase.map((product, index) => (
              <HeroProductTile key={product.id} product={product} position={index} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Three tiles fanned across the hero: one large in front, two tilted behind. */
const tilePositions = [
  'left-[18%] top-[6%] z-20 w-[52%] rotate-[-2deg]',
  'left-0 top-[34%] z-10 w-[38%] rotate-[-8deg]',
  'right-0 top-[18%] z-10 w-[38%] rotate-[7deg]',
]

function HeroProductTile({ product, position }: { product: Product; position: number }) {
  const { currency, amount } = splitDisplayPrice(product.price)

  return (
    <Link
      to={getProductPath(product.id, { from: 'home' })}
      className={`group absolute rounded-[20px] bg-bg-primary p-2 text-text-primary shadow-float transition-transform duration-300 hover:z-30 hover:rotate-0 hover:scale-[1.03] ${tilePositions[position]}`}
    >
      <div className="relative aspect-square overflow-hidden rounded-[14px] bg-bg-secondary">
        <img alt="" src={product.image} className="size-full object-cover" />
        {product.discount ? (
          <span className="tabular-price absolute left-2 top-2 rounded-md bg-primary-red px-1.5 py-0.5 text-xs font-bold text-text-inverse">
            {product.discount}
          </span>
        ) : null}
      </div>
      <div className="px-1.5 pb-1 pt-2">
        <p className="truncate text-xs font-semibold">{product.name}</p>
        <p className="tabular-price flex items-baseline gap-1 font-bold">
          {currency ? <span className="text-[10px]">{currency}</span> : null}
          <span className="text-sm">{amount}</span>
        </p>
      </div>
    </Link>
  )
}

/** Greets signed-in shoppers with shortcuts; invites everyone else to sign in. */
function WelcomeCard() {
  const { authUser, requestSignIn } = useAuth()
  const navigate = useNavigate()

  const go = (path: string) => {
    navigate(path)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!authUser) {
    return (
      <div className="flex flex-col gap-3 rounded-card bg-brand-light p-5">
        <div className="flex items-center gap-3">
          <OllooMark className="size-11 shrink-0" />
          <div className="min-w-0">
            <p className="font-display text-lg font-bold leading-tight text-text-primary">
              Welcome to olloo
            </p>
            <p className="text-xs font-medium text-text-secondary">
              Sign in to track orders and save favourites.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={requestSignIn}
          className="btn-brand flex h-11 cursor-pointer items-center justify-center rounded-full text-sm font-bold text-text-inverse transition-opacity hover:opacity-90"
        >
          Sign in or create account
        </button>
      </div>
    )
  }

  const shortcuts = [
    { label: 'Orders', icon: FileList3LineIcon, path: getAccountPath('orders') },
    { label: 'Wishlist', icon: HeartLineIcon, path: getWishlistPath() },
    { label: 'Addresses', icon: MapPin2LineIcon, path: getAccountPath('addresses') },
  ]

  return (
    <div className="flex flex-col gap-4 rounded-card bg-brand-light p-5">
      <div>
        <p className="text-xs font-semibold text-text-tertiary">Welcome back</p>
        <p className="font-display truncate text-xl font-bold text-text-primary">
          Hi, {authUser.displayName}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {shortcuts.map(({ label, icon: ShortcutIcon, path }) => (
          <button
            key={label}
            type="button"
            onClick={() => go(path)}
            className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl bg-bg-primary px-1 py-3 text-xs font-semibold text-text-primary transition-colors hover:text-brand"
          >
            <ShortcutIcon className="size-5 text-brand" aria-hidden />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** The single biggest price drop in the catalogue right now. */
function TopDealCard() {
  const [deal] = useTopDeals(1)
  if (!deal) return null

  const { currency, amount } = splitDisplayPrice(deal.price)

  return (
    <Link
      to={getProductPath(deal.id, { from: 'home' })}
      className="group flex flex-1 flex-col gap-3 rounded-card border border-border-primary bg-bg-primary p-4 transition-shadow hover:shadow-card"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-bold text-text-primary">
          <FireFillIcon className="size-4.5 text-primary-red" aria-hidden />
          Top deal
        </span>
        {deal.discount ? (
          <span className="tabular-price rounded-md bg-primary-red px-1.5 py-0.5 text-xs font-bold text-text-inverse">
            {deal.discount}
          </span>
        ) : null}
      </div>
      <div className="relative min-h-28 flex-1 overflow-hidden rounded-xl bg-bg-secondary">
        <img
          alt=""
          src={deal.image}
          className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="line-clamp-2 text-sm font-semibold leading-5 text-text-primary">{deal.name}</p>
        <div className="shrink-0 text-right">
          <p className="tabular-price flex items-baseline justify-end gap-1 font-bold text-primary-red">
            {currency ? <span className="text-xs">{currency}</span> : null}
            <span className="text-lg leading-none">{amount}</span>
          </p>
          {deal.originalPrice ? (
            <p className="tabular-price text-xs text-text-tertiary line-through">{deal.originalPrice}</p>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
