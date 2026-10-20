import { useMemo } from 'react'
import ArrowRightSLineIcon from 'remixicon-react/ArrowRightSLineIcon'
import { images } from '../assets/images'
import {
  aboutCommitmentParagraphs,
  aboutHeroSubtitle,
  aboutHeroTitle,
  aboutIntroParagraphs,
  aboutValues,
  aboutVisionText,
  formatStatCount,
  type AboutStat,
} from '../data/about'
import type { Product } from '../data/products'
import { useCatalog } from '../context/CatalogContext'
import { PageBreadcrumbs } from './PageBreadcrumbs'
import { getProductPath } from '../data/shopRoutes'
import { ProductCard } from './ProductCard'

type AboutPageContentProps = {
  onGoHome: () => void
  onProductSelect?: (product: Product) => void
}

/**
 * One page gutter for every band.
 *
 * The layout is edge-anchored rather than centred in a narrow column, so copy
 * and artwork start on the same line instead of drifting apart.
 */
const PAGE_GUTTER = 'px-4 lg:px-16'

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl font-semibold tracking-[-0.64px] text-text-primary lg:text-[40px] lg:leading-11 lg:tracking-[-1.2px]">
      {children}
    </h2>
  )
}

function SectionBody({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-150 lg:max-w-full text-base leading-6 tracking-[-0.32px] text-text-secondary lg:text-lg lg:leading-7">
      {children}
    </p>
  )
}

/**
 * The "Learn more" affordance that closes a copy block.
 *
 * `onDark` is for blocks laid over dark artwork or a black panel, where the
 * default ink colour would disappear against the background.
 */
function LearnMoreLink({
  href,
  children,
  onDark = false,
}: {
  href: string
  children: React.ReactNode
  onDark?: boolean
}) {
  return (
    <a
      href={href}
      className={`group inline-flex w-fit items-center gap-1 text-base font-semibold tracking-[-0.32px] ${
        onDark ? 'text-text-inverse' : 'text-text-primary'
      }`}
    >
      {children}
      <ArrowRightSLineIcon
        className="size-5 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </a>
  )
}

/**
 * Artwork for a band. Every slot names the photo it wants rather than reusing a
 * single placeholder, so swapping in new photography is a change to
 * `images.about` alone.
 */
function AboutImage({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  return (
    <div className={`relative overflow-hidden bg-bg-secondary ${className ?? ''}`}>
      <img alt={alt} className="absolute inset-0 size-full object-cover" src={src} />
    </div>
  )
}

/** A figure in the numbers band. */
function StatCard({ stat }: { stat: AboutStat }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border-secondary bg-bg-primary p-5">
      <span className="text-3xl font-semibold leading-10 tracking-[-1.28px] text-text-primary lg:text-[40px] lg:leading-12">
        {stat.value}
      </span>
      <span className="text-sm leading-4.5 tracking-[-0.28px] text-text-secondary lg:text-base">
        {stat.label}
      </span>
    </div>
  )
}

/**
 * Bento tiles for the values section.
 *
 * Each tile declares its own span so the grid reads as an intentional mosaic
 * rather than five equal boxes: one large photo tile anchors the top-left and
 * the rest fill around it at mixed sizes.
 */
const VALUE_TILES = [
  { span: 'lg:col-span-2 lg:row-span-2', surface: 'bg-black', image: images.about.peopleShopping },
  { span: '', surface: 'bg-green-light', image: null },
  { span: '', surface: 'bg-orange-light', image: null },
  { span: '', surface: 'bg-bg-secondary', image: images.about.mosaicTop },
  { span: 'lg:col-span-2', surface: 'bg-bg-primary', image: null },
] as const

function ValueTile({
  value,
  tile,
}: {
  value: (typeof aboutValues)[number]
  tile: (typeof VALUE_TILES)[number]
}) {
  const { title, description, Icon } = value
  // A photo tile carries white type over a scrim; a tinted tile uses the normal
  // text colours so it stays legible without an overlay.
  const isPhotoTile = tile.image !== null

  return (
    <article
      className={`relative flex min-h-45 flex-col justify-end gap-2 overflow-hidden rounded-2xl p-5 lg:min-h-0 ${tile.surface} ${tile.span}`}
    >
      {tile.image ? (
        <>
          <img
            alt=""
            aria-hidden
            className="absolute inset-0 size-full object-cover"
            src={tile.image}
          />
          <div className="absolute inset-0 bg-[rgba(0,6,7,0.55)]" aria-hidden />
        </>
      ) : null}

      <div className="relative flex flex-col gap-2">
        <Icon
          className={`size-6 shrink-0 ${isPhotoTile ? 'text-text-inverse' : 'text-primary-orange'}`}
          aria-hidden
        />
        <h3
          className={`text-xl font-semibold leading-7 tracking-[-0.4px] lg:text-2xl lg:leading-8 ${
            isPhotoTile ? 'text-text-inverse' : 'text-text-primary'
          }`}
        >
          {title}
        </h3>
        <p
          className={`max-w-130 text-sm leading-5.5 tracking-[-0.28px] lg:text-base lg:leading-6 ${
            isPhotoTile ? 'text-text-inverse/85' : 'text-text-secondary'
          }`}
        >
          {description}
        </p>
      </div>
    </article>
  )
}

export function AboutPageContent({ onGoHome, onProductSelect }: AboutPageContentProps) {
  const { categories, facets, featuredProducts, allProducts, isReady } = useCatalog()

  const recommendedProducts =
    isReady && featuredProducts.length > 0 ? featuredProducts.slice(0, 5) : []

  // The figures describe the store the shopper is actually looking at, so they
  // come from the loaded catalog rather than being written into the copy. While
  // the catalog is still in flight nothing is claimed: a "0 products" figure
  // would be a lie and a guessed one would be worse.
  const stats = useMemo<AboutStat[]>(() => {
    if (!isReady) return []

    const subcategoryCount = categories.reduce(
      (total, category) => total + (category.children?.length ?? 0),
      0,
    )

    return [
      { value: formatStatCount(allProducts.length), label: 'Products across our catalog' },
      { value: formatStatCount(categories.length), label: 'Departments' },
      { value: formatStatCount(subcategoryCount), label: 'Specialist categories' },
      { value: formatStatCount(facets.brands.length), label: 'Brands to shop' },
    ]
  }, [allProducts.length, categories, facets.brands, isReady])

  const firstParagraph = aboutIntroParagraphs[0]
  const remainingParagraphs = aboutIntroParagraphs.slice(1)

  return (
    <main>
      <PageBreadcrumbs
        segments={[
          { label: 'Home', onClick: onGoHome },
          { label: 'About' },
        ]}
      />

      {/* Hero: black panel carrying the headline, artwork beside it. */}
      <section className="overflow-hidden bg-black">
        <div className="grid lg:grid-cols-2">
          <div className="flex flex-col justify-center gap-5 px-4 py-14 lg:px-16 lg:py-24">
            <h1 className="max-w-150 text-4xl font-bold leading-tight tracking-[-1.28px] text-text-inverse lg:text-[56px] lg:leading-15 lg:tracking-[-1.68px]">
              {aboutHeroTitle}
            </h1>
            <p className="max-w-150 text-base leading-6 tracking-[-0.32px] text-text-inverse/85 lg:text-xl lg:leading-8">
              {aboutHeroSubtitle}
            </p>
          </div>

          <AboutImage
            alt="The H&CO. storefront"
            className="min-h-64 lg:min-h-125"
            src={images.about.storefront}
          />
        </div>
      </section>

      {/* Statement: the opening sentence set as the heading, with an artwork
          mosaic opposite it. */}
      <section className={`bg-bg-primary py-12  ${PAGE_GUTTER}`}>
        <div className="grid lg:grid-cols-2 gap-10">
          <div className="flex flex-col gap-5">
            <h2 className="max-w-180 lg:max-w-full text-2xl font-semibold leading-8 tracking-[-0.64px] text-text-primary lg:text-[32px] lg:leading-10 lg:tracking-[-0.96px]">
              At H&CO.
            </h2>
            <div className="max-w-180 lg:max-w-full text-base font-normal leading-8 tracking-[-0.64px] text-text-primary lg:text-lg lg:leading-10 lg:tracking-[-0.96px]">
              {firstParagraph}
            </div>
            {remainingParagraphs.map((paragraph) => (
              <SectionBody key={paragraph}>{paragraph}</SectionBody>
            ))}
            <LearnMoreLink href="#about-values">Learn more</LearnMoreLink>
          </div>

          <div className="grid grid-cols-2 grid-rows-2 gap-3">
            <AboutImage
              alt="An H&CO. customer"
              className="row-span-2 aspect-1 rounded-xl"
              src={images.about.portrait}
            />
            <AboutImage
              alt="H&CO. products"
              className="aspect-4/3 rounded-xl"
              src={images.about.mosaicTop}
            />
            <AboutImage
              alt="The H&CO. shopping experience"
              className="aspect-4/3 rounded-xl"
              src={images.about.mosaicBottom}
            />
          </div>
        </div>
      </section>

      {/* Numbers band: a boxed 2x2 grid with the vision statement beside it. */}
      {stats.length > 0 ? (
        <section
          className={`border-y border-border-primary bg-bg-secondary py-12 lg:py-16 ${PAGE_GUTTER}`}
        >
          <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-12">
            <div className="flex flex-col gap-6">
              <SectionHeading>H&CO. by the numbers</SectionHeading>
              <div className="grid grid-cols-2 gap-4">
                {stats.map((stat) => (
                  <StatCard key={stat.label} stat={stat} />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-5 rounded-xl bg-black p-6 lg:p-10">
              <h3 className="text-2xl font-semibold leading-8 tracking-[-0.64px] text-text-inverse lg:text-[32px] lg:leading-10">
                Our Vision
              </h3>
              <p className="max-w-150 text-base leading-6 tracking-[-0.32px] text-text-inverse/80 lg:text-lg lg:leading-7">
                {aboutVisionText}
              </p>
              <LearnMoreLink href="#about-values" onDark>
                Learn more
              </LearnMoreLink>
            </div>
          </div>
        </section>
      ) : null}

      {/* Values: a bento mosaic of mixed tile sizes. */}
      <section id="about-values" className={`bg-bg-primary py-12 lg:py-20 ${PAGE_GUTTER}`}>
        <div className="flex flex-col gap-8 lg:gap-12">
          <div className="flex flex-col gap-4">
            <SectionHeading>What We Stand For</SectionHeading>
            <SectionBody>
              The principles behind how we choose products, price them, and support the people who
              shop with us.
            </SectionBody>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {aboutValues.map((value, index) => (
              <ValueTile
                key={value.title}
                value={value}
                tile={VALUE_TILES[index % VALUE_TILES.length]}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Commitment: a wide photo band with the copy laid over it, so the
          section closes on imagery rather than another block of text. */}
      <section className="relative overflow-hidden">
        <img
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover"
          src={images.about.featureWide}
        />
        <div className="absolute inset-0 bg-[rgba(0,6,7,0.62)]" aria-hidden />

        <div className={`relative flex flex-col gap-6 py-14 lg:py-24 ${PAGE_GUTTER}`}>
          <div className="flex max-w-160 flex-col gap-5">
            <h2 className="text-2xl font-semibold leading-8 tracking-[-0.64px] text-text-inverse lg:text-[40px] lg:leading-11 lg:tracking-[-1.2px]">
              Our Commitment
            </h2>
            {aboutCommitmentParagraphs.map((paragraph) => (
              <p
                key={paragraph}
                className="max-w-150 text-base leading-6 tracking-[-0.32px] text-text-inverse/85 lg:text-lg lg:leading-7"
              >
                {paragraph}
              </p>
            ))}
            <LearnMoreLink href="#about-recommendations" onDark>
              Learn more
            </LearnMoreLink>
          </div>
        </div>
      </section>

      <section
        id="about-recommendations"
        className={`bg-bg-primary py-12 lg:py-16 ${PAGE_GUTTER}`}
      >
        <div className="flex flex-col gap-6">
          <SectionHeading>You might like</SectionHeading>
          <div className="grid grid-cols-2 items-stretch gap-2 lg:grid-cols-5">
            {recommendedProducts.map((product, index) => (
              <ProductCard
                key={`${product.id}-${index}`}
                product={product}
                enableAddButton
                to={getProductPath(product.id, { from: 'home' })}
                onClick={onProductSelect ? () => onProductSelect(product) : undefined}
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
