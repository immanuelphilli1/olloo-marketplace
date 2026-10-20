import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type TransitionEvent,
} from 'react'
import ArrowLeftSLineIcon from 'remixicon-react/ArrowLeftSLineIcon'
import ArrowRightSLineIcon from 'remixicon-react/ArrowRightSLineIcon'
import type { Product } from '../data/products'
import { getProductPath } from '../data/shopRoutes'
import { useCatalog } from '../context/CatalogContext'
import { CarouselDots } from './CarouselDots'
import { ProductCard } from './ProductCard'

const AUTO_PLAY_INTERVAL_MS = 8000
const MOBILE_PRODUCT_COUNT = 5
const DESKTOP_ITEMS_PER_VIEW = 4
const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)'
const TRANSITION_MS = 700

/**
 * Carousel arrows. On mobile the heading is a single 14px line, so a 42px
 * (`size-12`) button made the header row twice the height of its own text and
 * left the section looking loose. `size-9` on mobile keeps a comfortable tap
 * area while letting the row sit closer to the label.
 */
const carouselArrowButton =
  'group flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-bg-secondary px-2 transition-colors hover:bg-orange-light active:bg-orange-light lg:size-12 lg:px-3'
const carouselArrowIcon =
  'size-4 text-text-secondary transition-colors group-hover:text-primary-orange lg:size-5'

function buildLoopedProducts(products: Product[], cloneCount: number) {
  const prefix = products.slice(-cloneCount)
  const suffix = products.slice(0, cloneCount)

  return [...prefix, ...products, ...suffix]
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY)
    const update = () => setIsDesktop(mediaQuery.matches)

    update()
    mediaQuery.addEventListener('change', update)

    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  return isDesktop
}

type NewArrivalsSectionProps = {
  onProductSelect?: (product: Product) => void
}

export function NewArrivalsSection({ onProductSelect }: NewArrivalsSectionProps) {
  const { newArrivalProducts, isReady } = useCatalog()
  const newArrivalProductsList = isReady ? newArrivalProducts : []
  const hasProducts = newArrivalProductsList.length > 0
  const productCount = hasProducts ? newArrivalProductsList.length : 1
  const mobileProducts = newArrivalProductsList.slice(0, MOBILE_PRODUCT_COUNT)
  const isDesktop = useIsDesktop()
  const mobileTrackRef = useRef<HTMLDivElement>(null)
  const [mobileActiveIndex, setMobileActiveIndex] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const slideIndexRef = useRef(DESKTOP_ITEMS_PER_VIEW)
  const startIndex = DESKTOP_ITEMS_PER_VIEW
  const isAnimatingRef = useRef(false)
  const resetTimeoutRef = useRef<number | null>(null)

  const [slideIndex, setSlideIndexState] = useState(DESKTOP_ITEMS_PER_VIEW)
  const [slideStep, setSlideStep] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [enableTransition, setEnableTransition] = useState(true)

  const resetEndIndex = startIndex + productCount
  const resetStartIndex = startIndex + productCount - 1

  const loopedProducts = useMemo(
    () => buildLoopedProducts(newArrivalProductsList, DESKTOP_ITEMS_PER_VIEW),
    [newArrivalProductsList],
  )

  const setSlideIndex = useCallback((nextIndex: number | ((index: number) => number)) => {
    setSlideIndexState((current) => {
      const resolved = typeof nextIndex === 'function' ? nextIndex(current) : nextIndex
      slideIndexRef.current = resolved
      return resolved
    })
  }, [])

  const activeProductIndex =
    (((slideIndex - startIndex) % productCount) + productCount) % productCount

  const clearResetTimeout = useCallback(() => {
    if (resetTimeoutRef.current !== null) {
      window.clearTimeout(resetTimeoutRef.current)
      resetTimeoutRef.current = null
    }
  }, [])

  const jumpWithoutTransition = useCallback(
    (nextIndex: number) => {
      clearResetTimeout()
      isAnimatingRef.current = false
      setEnableTransition(false)
      setSlideIndex(nextIndex)
    },
    [clearResetTimeout, setSlideIndex],
  )

  const normalizeSlideIndex = useCallback(() => {
    const currentIndex = slideIndexRef.current

    if (currentIndex >= resetEndIndex) {
      jumpWithoutTransition(startIndex)
      return true
    }

    if (currentIndex < startIndex) {
      jumpWithoutTransition(resetStartIndex)
      return true
    }

    return false
  }, [jumpWithoutTransition, resetEndIndex, resetStartIndex, startIndex])

  const scheduleResetFallback = useCallback(() => {
    clearResetTimeout()
    resetTimeoutRef.current = window.setTimeout(() => {
      normalizeSlideIndex()
    }, TRANSITION_MS + 50)
  }, [clearResetTimeout, normalizeSlideIndex])

  const measureSlideStep = useCallback(() => {
    const track = trackRef.current
    const firstSlide = track?.firstElementChild

    if (!track || !(firstSlide instanceof HTMLElement)) return

    const styles = window.getComputedStyle(track)
    const gap = Number.parseFloat(styles.gap || styles.columnGap || '8') || 8
    setSlideStep(firstSlide.offsetWidth + gap)
  }, [])

  const beginSlide = useCallback(
    (direction: 'next' | 'prev') => {
      if (isAnimatingRef.current) return

      isAnimatingRef.current = true
      setEnableTransition(true)
      setSlideIndex((index) => (direction === 'next' ? index + 1 : index - 1))
      scheduleResetFallback()
    },
    [scheduleResetFallback, setSlideIndex],
  )

  const showPreviousSlide = useCallback(() => {
    beginSlide('prev')
  }, [beginSlide])

  const showNextSlide = useCallback(() => {
    beginSlide('next')
  }, [beginSlide])

  const goToProduct = useCallback(
    (productIndex: number) => {
      if (isAnimatingRef.current) return

      clearResetTimeout()
      isAnimatingRef.current = false
      setEnableTransition(true)
      setSlideIndex(startIndex + productIndex)
    },
    [clearResetTimeout, setSlideIndex, startIndex],
  )

  const handleTransitionEnd = useCallback(
    (event: TransitionEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget || event.propertyName !== 'transform') return

      clearResetTimeout()
      isAnimatingRef.current = false

      if (normalizeSlideIndex()) return

      setEnableTransition(true)
    },
    [clearResetTimeout, normalizeSlideIndex],
  )

  useEffect(() => {
    jumpWithoutTransition(startIndex)
  }, [jumpWithoutTransition, newArrivalProductsList, startIndex])

  useEffect(() => {
    if (!isDesktop) return

    measureSlideStep()

    const track = trackRef.current
    if (!track) return

    const observer = new ResizeObserver(measureSlideStep)
    observer.observe(track)

    return () => observer.disconnect()
  }, [isDesktop, measureSlideStep, newArrivalProductsList])

  useEffect(() => {
    if (!isDesktop || enableTransition) return

    const frameId = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setEnableTransition(true))
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [enableTransition, isDesktop, slideIndex])

  useEffect(() => {
    if (!hasProducts || !isDesktop || isPaused) return

    const intervalId = window.setInterval(showNextSlide, AUTO_PLAY_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [hasProducts, isDesktop, isPaused, showNextSlide])

  useEffect(() => clearResetTimeout, [clearResetTimeout])

  const handleMobileScroll = useCallback(() => {
    const track = mobileTrackRef.current
    const firstSlide = track?.firstElementChild

    if (!track || !(firstSlide instanceof HTMLElement)) return

    const styles = window.getComputedStyle(track)
    const gap = Number.parseFloat(styles.gap || styles.columnGap || '8') || 8
    const step = firstSlide.offsetWidth + gap
    if (!step) return

    setMobileActiveIndex(Math.min(Math.round(track.scrollLeft / step), mobileProducts.length - 1))
  }, [mobileProducts.length])

  const scrollToMobileProduct = useCallback((index: number) => {
    const track = mobileTrackRef.current
    const firstSlide = track?.firstElementChild

    if (!track || !(firstSlide instanceof HTMLElement)) return

    const styles = window.getComputedStyle(track)
    const gap = Number.parseFloat(styles.gap || styles.columnGap || '8') || 8
    const step = firstSlide.offsetWidth + gap

    track.scrollTo({ left: step * index, behavior: 'smooth' })
    setMobileActiveIndex(index)
  }, [])

  const showMobilePrevious = useCallback(() => {
    scrollToMobileProduct(Math.max(0, mobileActiveIndex - 1))
  }, [mobileActiveIndex, scrollToMobileProduct])

  const showMobileNext = useCallback(() => {
    scrollToMobileProduct(Math.min(mobileProducts.length - 1, mobileActiveIndex + 1))
  }, [mobileActiveIndex, mobileProducts.length, scrollToMobileProduct])

  return (
    <section className="overflow-x-clip border-b border-border-primary px-4 lg:px-16">
      <div className="flex flex-col gap-2 py-4 lg:gap-4 lg:py-6">
        <div className="flex items-center">
          <h2 className="flex-1 text-base font-medium leading-5 tracking-[-0.32px] text-text-primary lg:text-2xl lg:leading-8 lg:tracking-[-0.48px]">
            New Arrivals
          </h2>
          {hasProducts ? (
            <div className="flex items-center gap-2 lg:gap-4">
              <button
                type="button"
                onClick={isDesktop ? showPreviousSlide : showMobilePrevious}
                className={carouselArrowButton}
                aria-label="Previous products"
              >
                <ArrowLeftSLineIcon className={carouselArrowIcon} aria-hidden />
              </button>
              <button
                type="button"
                onClick={isDesktop ? showNextSlide : showMobileNext}
                className={carouselArrowButton}
                aria-label="Next products"
              >
                <ArrowRightSLineIcon className={carouselArrowIcon} aria-hidden />
              </button>
            </div>
          ) : null}
        </div>

        {hasProducts && isDesktop ? (
          <>
            <div
              className="overflow-hidden"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              <div
                ref={trackRef}
                onTransitionEnd={handleTransitionEnd}
                className={`flex gap-2 will-change-transform ${enableTransition ? 'transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]' : ''}`}
                style={{
                  transform: slideStep ? `translate3d(-${slideIndex * slideStep}px, 0, 0)` : undefined,
                }}
              >
                {loopedProducts.map((product, index) => (
                  <div
                    key={`${product.id}-${index}`}
                    className="flex w-[calc((100%-1.5rem)/4)] min-w-0 shrink-0"
                  >
                    <ProductCard
                      product={product}
                      enableAddButton
                      to={getProductPath(product.id, { from: 'home' })}
                      onClick={onProductSelect ? () => onProductSelect(product) : undefined}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 px-8 py-2">
              {newArrivalProductsList.map((product, index) => (
                <button
                  key={`${product.id}-${index}`}
                  type="button"
                  onClick={() => goToProduct(index)}
                  aria-label={`Go to ${product.name}`}
                  className={`rounded-full transition-[width,background-color] duration-300 ${
                    index === activeProductIndex
                      ? 'h-2 w-8 bg-primary-orange'
                      : 'size-2 bg-bg-tertiary hover:bg-border-secondary'
                  }`}
                />
              ))}
            </div>
          </>
        ) : hasProducts ? (
          <>
            <div
              ref={mobileTrackRef}
              onScroll={handleMobileScroll}
              className="flex gap-2 overflow-x-auto scroll-smooth snap-x snap-mandatory [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden"
            >
              {mobileProducts.map((product, index) => (
                <div
                  key={`${product.id}-${index}`}
                  className="w-[calc((100%-8px)/2)] shrink-0 snap-start"
                >
                  <ProductCard
                    product={product}
                    enableAddButton
                    to={getProductPath(product.id, { from: 'home' })}
                    onClick={onProductSelect ? () => onProductSelect(product) : undefined}
                  />
                </div>
              ))}
            </div>

            <CarouselDots
              count={mobileProducts.length}
              activeIndex={mobileActiveIndex}
              onSelect={scrollToMobileProduct}
            />
          </>
        ) : null}
      </div>
    </section>
  )
}
