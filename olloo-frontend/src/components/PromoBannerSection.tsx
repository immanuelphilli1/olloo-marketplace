import { useEffect, useState } from 'react'
import { CarouselDots } from './CarouselDots'
import { useHomePlacements } from '../context/HomePlacementsContext'
import { BannerLink } from '../utils/bannerLink'

type PromoBannerSectionProps = {
  onShopAllCategories: () => void
}

const AUTO_PLAY_INTERVAL_MS = 5000

export function PromoBannerSection({ onShopAllCategories: _onShopAllCategories }: PromoBannerSectionProps) {
  const { promo: promoSlides } = useHomePlacements()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    setCurrentSlide(0)
  }, [promoSlides.length])

  useEffect(() => {
    if (isPaused || promoSlides.length <= 1) return

    const intervalId = window.setInterval(() => {
      setCurrentSlide((slide) => (slide + 1) % promoSlides.length)
    }, AUTO_PLAY_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [isPaused, promoSlides.length])

  if (promoSlides.length === 0) {
    return null
  }

  const activeSlide = promoSlides[currentSlide]

  return (
    <section className="px-4 lg:px-16">
      <div
        className="relative h-40 overflow-hidden rounded-card bg-bg-secondary lg:h-80"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {promoSlides.map((slide, index) => {
          const image = (
            <img
              alt={slide.altText}
              aria-hidden={index !== currentSlide}
              className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${
                index === currentSlide ? 'opacity-100' : 'opacity-0'
              }`}
              src={slide.imageUrl}
            />
          )

          return slide.linkUrl ? (
            <BannerLink
              key={slide.rid}
              linkUrl={slide.linkUrl}
              className="absolute inset-0 block"
            >
              {image}
            </BannerLink>
          ) : (
            <div key={slide.rid} className="absolute inset-0">
              {image}
            </div>
          )
        })}

        {activeSlide &&
        (activeSlide.title || activeSlide.description || activeSlide.buttonText) ? (
          <div
            key={activeSlide.rid}
            className="pointer-events-none relative flex h-full flex-col justify-center overflow-hidden px-6 py-8 transition-opacity duration-500 lg:px-20 lg:py-10"
          >
            <div className="flex flex-col justify-center gap-4">
              {activeSlide.title ? (
                <h2 className="font-display max-w-50 text-xl font-bold leading-tight tracking-[-0.02em] text-text-inverse lg:max-w-xl lg:text-[40px]">
                  {activeSlide.title}
                </h2>
              ) : null}
              {activeSlide.description ? (
                <p className="max-w-50 text-base tracking-[-0.32px] text-text-inverse lg:max-w-xl">
                  {activeSlide.description}
                </p>
              ) : null}
              {activeSlide.buttonText && activeSlide.linkUrl ? (
                <BannerLink
                  linkUrl={activeSlide.linkUrl}
                  className="pointer-events-auto inline-flex w-fit rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-accent-ink"
                >
                  {activeSlide.buttonText}
                </BannerLink>
              ) : null}
            </div>
          </div>
        ) : null}

        {promoSlides.length > 1 ? (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-glass p-1 lg:bottom-4 lg:gap-2 lg:p-2">
            <CarouselDots
              count={promoSlides.length}
              activeIndex={currentSlide}
              onSelect={setCurrentSlide}
              className="gap-1 px-0 py-0 lg:gap-2 lg:px-0 lg:py-0"
            />
          </div>
        ) : null}
      </div>
    </section>
  )
}
