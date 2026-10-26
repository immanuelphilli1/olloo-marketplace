import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { catalogApi } from '../api'
import { getAccountPath } from '../data/accountRoutes'
import { mapApiProduct, mapApiProductReview } from '../api/mappers'
import AddLineIcon from 'remixicon-react/AddLineIcon'
import ArrowLeftSLineIcon from 'remixicon-react/ArrowLeftSLineIcon'
import ArrowRightSLineIcon from 'remixicon-react/ArrowRightSLineIcon'
import HeartFillIcon from 'remixicon-react/HeartFillIcon'
import HeartLineIcon from 'remixicon-react/HeartLineIcon'
import MapPin2LineIcon from 'remixicon-react/MapPin2LineIcon'
import PriceTag3LineIcon from 'remixicon-react/PriceTag3LineIcon'
import Refund2LineIcon from 'remixicon-react/Refund2LineIcon'
import ShareForwardBoxFillIcon from 'remixicon-react/ShareForwardBoxFillIcon'
import ShieldCheckLineIcon from 'remixicon-react/ShieldCheckLineIcon'
import ShieldUserFillIcon from 'remixicon-react/ShieldUserFillIcon'
import SubtractLineIcon from 'remixicon-react/SubtractLineIcon'
import TruckLineIcon from 'remixicon-react/TruckLineIcon'
import User6LineIcon from 'remixicon-react/User6LineIcon'
import { useAuth } from '../context/AuthContext'
import { useCatalog } from '../context/CatalogContext'
import { useShop } from '../context/ShopContext'
import { useProductDestination } from '../hooks/useProductDestination'
import { useShareLink } from '../hooks/useShareLink'
import type {
  ProductDetail,
  ProductDetailContext,
  ProductFamily,
  ProductOptionGroup,
  ProductReview,
} from '../data/productDetail'
import { useProductDetailSelection } from '../hooks/useProductDetailSelection'
import type { Product } from '../data/products'
import { getProductPathForListingSelection } from '../data/shopRoutes'
import { formatAmount, splitDisplayPrice } from '../data/format'
import type { DefaultAddress } from '../data/profile'
import { ProductCard } from './ProductCard'
import { RatingStars } from './RatingStars'

const REVIEWS_PAGE_SIZE = 10

type ProductDetailViewProps = {
  context: ProductDetailContext
  /** The signed-in shopper's default address; null for guests or when none is saved. */
  deliveryAddress: DefaultAddress | null
  onGoHome: () => void
  onBackToListing: () => void
  onGoToCart: () => void
  onProductSelect: (product: Product) => void
}

function ProductDetailBreadcrumbs({
  categoryLabel,
  subcategoryLabel,
  productName,
  onGoHome,
  onBackToListing,
}: {
  categoryLabel: string
  subcategoryLabel: string
  productName: string
  onGoHome: () => void
  onBackToListing: () => void
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-1 px-4 py-2 lg:px-16"
    >
      <button
        type="button"
        onClick={onGoHome}
        className="cursor-pointer py-2.5 text-sm font-medium leading-4 tracking-[-0.28px] text-text-tertiary transition-colors hover:text-text-primary"
      >
        Home
      </button>
      <ArrowRightSLineIcon className="size-6 shrink-0 text-text-tertiary" aria-hidden />
      <button
        type="button"
        onClick={onBackToListing}
        className="cursor-pointer py-2.5 text-sm font-medium leading-4 tracking-[-0.28px] text-text-tertiary transition-colors hover:text-text-primary"
      >
        {categoryLabel}
      </button>
      <ArrowRightSLineIcon className="size-6 shrink-0 text-text-tertiary" aria-hidden />
      <button
        type="button"
        onClick={onBackToListing}
        className="cursor-pointer py-2.5 text-sm font-medium leading-4 tracking-[-0.28px] text-text-tertiary transition-colors hover:text-text-primary"
      >
        {subcategoryLabel}
      </button>
      <ArrowRightSLineIcon className="size-6 shrink-0 text-text-tertiary" aria-hidden />
      <span className="max-w-full truncate py-2.5 text-sm font-medium leading-4 tracking-[-0.28px] text-text-primary">
        {productName}
      </span>
    </nav>
  )
}

function ProductImageGallery({
  images,
  productName,
  activeIndex: controlledIndex,
  onActiveIndexChange,
}: {
  images: string[]
  productName: string
  activeIndex?: number
  onActiveIndexChange?: (index: number) => void
}) {
  const [internalIndex, setInternalIndex] = useState(0)
  const activeIndex = controlledIndex ?? internalIndex
  const setActiveIndex = onActiveIndexChange ?? setInternalIndex

  const showPrevious = () => {
    setActiveIndex(activeIndex === 0 ? images.length - 1 : activeIndex - 1)
  }

  const showNext = () => {
    setActiveIndex(activeIndex === images.length - 1 ? 0 : activeIndex + 1)
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="hidden flex-col gap-4 lg:flex">
        {images.map((image, index) => (
          <button
            key={`${image}-${index}`}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={`relative size-18 shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 bg-bg-secondary transition-colors ${
              index === activeIndex ? 'border-brand' : 'border-transparent hover:border-border-secondary'
            }`}
            aria-label={`View image ${index + 1}`}
            aria-current={index === activeIndex}
          >
            <img alt="" className="size-full object-cover" src={image} />
          </button>
        ))}
      </div>

      <div className="flex w-full flex-col gap-4 lg:flex-1">
        <div className="relative aspect-square w-full overflow-hidden rounded-card bg-bg-secondary lg:max-w-110">
          <img
            alt={productName}
            className="absolute inset-0 size-full object-contain"
            src={images[activeIndex]}
          />
          <div className="absolute inset-x-4 top-1/2 flex -translate-y-1/2 items-center justify-between">
            <button
              type="button"
              onClick={showPrevious}
              className="flex size-12 cursor-pointer items-center justify-center rounded-full bg-bg-primary shadow-[0px_1px_2px_rgba(0,0,0,0.04),0px_4px_6px_rgba(0,0,0,0.06)]"
              aria-label="Previous image"
            >
              <ArrowLeftSLineIcon className="size-6 text-text-secondary" aria-hidden />
            </button>
            <button
              type="button"
              onClick={showNext}
              className="flex size-12 cursor-pointer items-center justify-center rounded-full bg-bg-primary shadow-[0px_1px_2px_rgba(0,0,0,0.04),0px_4px_6px_rgba(0,0,0,0.06)] lg:bg-bg-secondary"
              aria-label="Next image"
            >
              <ArrowRightSLineIcon className="size-6 text-text-secondary" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex w-full items-center justify-between lg:hidden">
          {images.map((image, index) => (
            <button
              key={`mobile-${image}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`relative size-18 shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 bg-bg-secondary transition-colors ${
                index === activeIndex ? 'border-brand' : 'border-transparent'
              }`}
              aria-label={`View image ${index + 1}`}
              aria-current={index === activeIndex}
            >
              <img alt="" className="size-full object-cover" src={image} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ReviewCard({ review, isOwn = false }: { review: ProductReview; isOwn?: boolean }) {
  return (
    <div
      className={`flex flex-col gap-2 ${
        isOwn ? 'rounded-xl border border-brand-lighter bg-brand-light/60 p-3' : ''
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="flex size-6 items-center justify-center rounded-full bg-bg-tertiary">
          <User6LineIcon className="size-4 text-text-secondary" aria-hidden />
        </span>
        <span className="font-semibold text-text-primary">{isOwn ? 'Your review' : review.author}</span>
        {review.location ? <span className="text-text-secondary">in {review.location}</span> : null}
        {review.date ? <span className="text-text-tertiary">· {review.date}</span> : null}
        {isOwn && review.status === 'pending' ? (
          <span className="rounded-full bg-accent-light px-2 py-0.5 text-xs font-semibold text-accent-ink">
            Awaiting approval
          </span>
        ) : null}
      </div>
      <RatingStars value={review.rating} size="sm" />
      {review.title ? <p className="text-sm font-bold text-text-primary">{review.title}</p> : null}
      {review.text ? <p className="text-sm leading-relaxed text-text-secondary">{review.text}</p> : null}
      {isOwn && review.status === 'pending' ? (
        <p className="text-xs text-text-tertiary">Only you can see it until our team approves it.</p>
      ) : null}
    </div>
  )
}

function ProductReviewsSection({
  reviewCount,
  ratingValue,
  reviews,
  myReview,
  canLoadMore,
  isLoadingMore,
  onLoadMore,
}: {
  reviewCount: number
  ratingValue: number
  reviews: ProductReview[]
  /** The shopper's own review of this product, in any status. */
  myReview: ProductReview | null
  canLoadMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
}) {
  // A published own review is already in the list; it is shown once, on top.
  const others = myReview?.rid ? reviews.filter((review) => review.rid !== myReview.rid) : reviews
  const hasAnyReview = reviewCount > 0 || myReview !== null

  return (
    <div className="overflow-hidden bg-bg-primary xl:rounded-card xl:border xl:border-border-primary">
      <div className="flex items-center justify-between gap-2 border-b border-border-primary p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="text-base font-bold text-text-primary">
            {reviewCount === 1 ? '1 review' : `${reviewCount} reviews`}
          </p>
          <span className="h-4.5 w-px bg-border-secondary" aria-hidden />
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">{ratingValue.toFixed(1)}</span>
            <RatingStars value={ratingValue} size="sm" />
          </div>
        </div>

        <div className="hidden shrink-0 items-center overflow-hidden rounded-full bg-green-light lg:inline-flex">
          <span className="flex items-center bg-primary-green py-1 pl-1.5 pr-1">
            <ShieldUserFillIcon className="size-4 text-text-inverse" aria-hidden />
          </span>
          <span className="px-2 py-1 text-xs font-medium leading-4 tracking-[-0.24px] text-primary-green">
            Reviews come from verified purchases
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {myReview ? <ReviewCard review={myReview} isOwn /> : null}
        {others.map((review, index) => (
          <ReviewCard key={review.rid ?? `${review.author}-${index}`} review={review} />
        ))}
        {!hasAnyReview ? (
          <p className="text-sm text-text-secondary">
            No reviews yet. Shoppers who buy this item can review it from <b>Your reviews</b>.
          </p>
        ) : null}
      </div>

      {canLoadMore ? (
        <div className="flex justify-center p-4 pt-0">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="flex h-10 w-full max-w-50 cursor-pointer items-center justify-center rounded-full border border-border-secondary px-4 text-sm font-bold text-text-primary transition-colors hover:border-brand hover:text-brand disabled:cursor-wait disabled:opacity-60"
          >
            {isLoadingMore ? 'Loading…' : 'See more reviews'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function QuantityStepper({
  quantity,
  onDecrease,
  onIncrease,
}: {
  quantity: number
  onDecrease: () => void
  onIncrease: () => void
}) {
  return (
    <div className="flex w-26.75 items-center">
      <button
        type="button"
        onClick={onDecrease}
        disabled={quantity <= 1}
        className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-border-secondary disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Decrease quantity"
      >
        <SubtractLineIcon className="size-5 text-text-secondary" aria-hidden />
      </button>
      <span className="flex flex-1 items-center justify-center px-4 text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
        {quantity}
      </span>
      <button
        type="button"
        onClick={onIncrease}
        className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-border-secondary"
        aria-label="Increase quantity"
      >
        <AddLineIcon className="size-5 text-text-secondary" aria-hidden />
      </button>
    </div>
  )
}

/**
 * Other sizes of the same model, each uploaded as its own product. Picking one
 * opens that product's page, the way Amazon moves between separate listings.
 */
function FamilyOptions({
  family,
  onSelect,
}: {
  family: ProductFamily
  onSelect: (rid: string) => void
}) {
  const current = family.options.find((option) => option.isCurrent)

  return (
    <div className="border-b border-border-primary py-4 xl:p-4">
      <p className="mb-2 text-sm text-text-secondary">
        {family.optionName}:{' '}
        <span className="font-bold text-text-primary">{current?.value ?? 'Choose one'}</span>
      </p>
      <div role="radiogroup" aria-label={family.optionName} className="flex flex-wrap gap-2">
        {family.options.map((option) => (
          <button
            key={option.rid}
            type="button"
            role="radio"
            aria-checked={option.isCurrent}
            onClick={() => {
              if (!option.isCurrent) onSelect(option.rid)
            }}
            className={`flex min-w-24 cursor-pointer flex-col items-start gap-0.5 rounded-xl border-2 px-3 py-2 text-left transition-colors ${
              option.isCurrent
                ? 'border-brand bg-brand-light'
                : 'border-border-secondary bg-bg-primary hover:border-text-tertiary'
            } ${option.inStock ? '' : 'opacity-60'}`}
          >
            <span className={`text-sm font-bold ${option.isCurrent ? 'text-brand' : 'text-text-primary'}`}>
              {option.value}
            </span>
            <span className="tabular-price text-xs font-medium text-text-secondary">
              {option.inStock ? option.price : 'Sold out'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ProductInfoPanel({
  product,
  detail,
  isLiked,
  onToggleLike,
  variantTitle,
  optionGroups,
  selections,
  onSelectOption,
  isOptionDisabled,
  showLegacyVariantRow,
  legacyVariantNames,
  legacyVariantIndex,
  onSelectLegacyVariant,
  showVariantPicker,
  displayPriceAmount,
  displayPriceCurrency,
  inStock,
  quantity,
  onDecreaseQuantity,
  onIncreaseQuantity,
  onAddToCart,
  onBuyNow,
  onShare,
  shareStatus,
  onSelectFamilyOption,
}: {
  product: Product
  detail: ProductDetail
  isLiked: boolean
  onToggleLike: () => void
  variantTitle?: string
  optionGroups: ProductOptionGroup[]
  selections: Record<string, string>
  onSelectOption: (groupKey: string, value: string) => void
  isOptionDisabled: (groupKey: string, value: string) => boolean
  showLegacyVariantRow: boolean
  legacyVariantNames: string[]
  legacyVariantIndex: number
  onSelectLegacyVariant: (index: number) => void
  showVariantPicker: boolean
  displayPriceAmount: string
  displayPriceCurrency: string
  inStock: boolean
  quantity: number
  onDecreaseQuantity: () => void
  onIncreaseQuantity: () => void
  onAddToCart: () => void
  onBuyNow: () => void
  onShare: () => void
  shareStatus: string | null
  /** Opens another size of this model (a separate product). */
  onSelectFamilyOption: (rid: string) => void
}) {
  // `discount` is derived from the API's `discountPercent` during mapping; the
  // promotional-notice string it replaced is no longer sent, so the badge hides
  // itself when the product has no discount.
  //
  // The original price is only known for the default variant, so the strike
  // price and badge show only while that variant's price is displayed; another
  // variant at a different price would otherwise appear discounted.
  const isDefaultPrice = splitDisplayPrice(product.price).amount === displayPriceAmount
  const discountBadge = isDefaultPrice ? (product.discount ?? '') : ''
  const originalPrice = isDefaultPrice ? product.originalPrice : undefined

  return (
    <div className="min-w-0 flex-1 overflow-hidden bg-bg-primary xl:max-w-98 xl:rounded-card xl:border xl:border-border-primary">
      <div className="border-b border-border-primary py-4 xl:p-4">
        <div className="mb-2 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {product.brand ? (
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.08em] text-brand">
                {product.brand}
              </p>
            ) : null}
            <h1 className="font-display text-2xl font-bold leading-tight tracking-[-0.02em] text-text-primary">
              {product.name}
            </h1>
          </div>
          <button
            type="button"
            onClick={onToggleLike}
            className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-bg-secondary"
            aria-label={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
            aria-pressed={isLiked}
          >
            {isLiked ? (
              <HeartFillIcon className="size-5 text-primary-red" aria-hidden />
            ) : (
              <HeartLineIcon className="size-5 text-text-secondary" aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={onShare}
            className="relative flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-bg-secondary"
            aria-label="Share product"
          >
            <ShareForwardBoxFillIcon className="size-5 text-text-secondary" aria-hidden />
            {/* Confirmation for the clipboard fallback, where the native sheet
                gives no feedback of its own. */}
            {shareStatus ? (
              <span
                role="status"
                className="absolute right-0 top-12 z-10 w-max rounded-lg bg-bg-secondary px-2 py-1 text-xs font-medium leading-4 tracking-[-0.24px] text-text-primary shadow-lg"
              >
                {shareStatus}
              </span>
            ) : null}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-4 tracking-[-0.28px] text-text-secondary">
          <RatingStars value={detail.ratingValue} size="sm" />
          <span>
            <span className="font-bold text-text-primary">{detail.ratingValue.toFixed(1)}</span>{' '}
            {detail.reviewCount > 0
              ? `(${detail.reviewCount} ${detail.reviewCount === 1 ? 'review' : 'reviews'})`
              : '(no reviews yet)'}
          </span>
          <span className="h-4.5 w-px bg-border-secondary" aria-hidden />
          <span>{detail.soldCount} sold</span>
        </div>
      </div>

      <div className="border-b border-border-primary py-4 xl:p-4">
        {variantTitle ? (
          <p className="mb-2 text-sm font-medium leading-4 tracking-[-0.28px] text-text-secondary">
            {variantTitle}
          </p>
        ) : null}
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
          <p
            className={`tabular-price flex items-baseline gap-1 ${
              discountBadge ? 'text-primary-red' : 'text-text-primary'
            }`}
          >
            <span className="text-base font-bold">{displayPriceCurrency}</span>
            <span className="text-[32px] font-extrabold leading-none tracking-[-0.02em]">
              {displayPriceAmount}
            </span>
          </p>
          {originalPrice ? (
            <span className="tabular-price pb-0.5 text-sm text-text-tertiary line-through">
              {originalPrice}
            </span>
          ) : null}
        </div>
        {/* The promo notice string is deprecated, so the badge is driven by the
            real discount percentage and hidden when there is no discount. */}
        {discountBadge ? (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-red-light px-2 py-1">
            <PriceTag3LineIcon className="size-4 text-primary-red" aria-hidden />
            <span className="text-xs font-bold text-primary-red">{discountBadge} off today</span>
          </div>
        ) : null}
      </div>

      {detail.family ? <FamilyOptions family={detail.family} onSelect={onSelectFamilyOption} /> : null}

      {showVariantPicker ? (
        <div className="border-b border-border-primary py-4 xl:p-4">
          {optionGroups.map((group) => (
            <div key={group.key} className="mb-4 last:mb-0">
              <p className="mb-2 text-sm font-medium leading-4 tracking-[-0.28px] text-text-primary">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.values.map((value) => {
                  const isSelected = selections[group.key] === value
                  const disabled = isOptionDisabled(group.key, value)

                  return (
                    <button
                      key={`${group.key}-${value}`}
                      type="button"
                      onClick={() => onSelectOption(group.key, value)}
                      className={`cursor-pointer rounded-lg border-2 px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                        isSelected
                          ? 'border-brand bg-brand-light text-brand'
                          : 'border-border-secondary bg-bg-primary text-text-secondary hover:border-text-tertiary'
                      }`}
                      aria-disabled={disabled}
                    >
                      {value}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {showLegacyVariantRow ? (
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium leading-4 tracking-[-0.28px] text-text-primary">
                Option
              </p>
              <div className="flex flex-wrap gap-2">
                {legacyVariantNames.map((name, index) => {
                  const isSelected = legacyVariantIndex === index
                  return (
                    <button
                      key={`${name}-${index}`}
                      type="button"
                      onClick={() => onSelectLegacyVariant(index)}
                      className={`cursor-pointer rounded-lg border-2 px-3 py-1.5 text-sm font-semibold ${
                        isSelected
                          ? 'border-brand bg-brand-light text-brand'
                          : 'border-border-secondary bg-bg-primary text-text-secondary hover:border-text-tertiary'
                      }`}
                    >
                      {name}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="border-b border-border-primary py-4 xl:p-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-text-primary">Quantity</span>
          <QuantityStepper
            quantity={quantity}
            onDecrease={onDecreaseQuantity}
            onIncrease={onIncreaseQuantity}
          />
        </div>
      </div>

      <div className="border-b border-border-primary py-4 xl:p-4">
        <p className="mb-2 text-sm font-bold text-text-primary">
          Product Description
        </p>
        <div className="flex flex-col gap-2 text-sm leading-4 tracking-[-0.28px] text-text-primary">
          {detail.descriptionLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>

      {product.attributes && product.attributes.length > 0 ? (
        <div className="border-t border-border-primary py-4 xl:px-4">
          <p className="mb-3 text-sm font-bold text-text-primary">
            Specifications
          </p>
          {/* `label` comes from the API, so the rows follow the order and wording
              the category defines without a client change. */}
          <dl className="flex flex-col gap-2">
            {product.attributes.map((attribute) => (
              <div
                key={attribute.key}
                className="flex items-start justify-between gap-4 text-sm leading-4 tracking-[-0.28px]"
              >
                <dt className="text-text-secondary">{attribute.label}</dt>
                <dd className="text-right text-text-primary">{attribute.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <div className="flex gap-3 py-4 xl:p-4">
        <button
          type="button"
          onClick={onAddToCart}
          disabled={!inStock}
          className="flex h-12 flex-1 cursor-pointer items-center justify-center rounded-full bg-brand-light px-4 text-base font-bold text-brand transition-colors hover:bg-brand-lighter disabled:cursor-not-allowed disabled:opacity-50"
        >
          {inStock ? 'Add to Cart' : 'Out of stock'}
        </button>
        <button
          type="button"
          onClick={onBuyNow}
          disabled={!inStock}
          className="btn-brand flex h-12 flex-1 cursor-pointer items-center justify-center rounded-full px-4 text-base font-bold text-text-inverse shadow-[0_10px_24px_-10px_rgba(91,43,224,0.8)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          Buy Now
        </button>
      </div>
    </div>
  )
}

function DeliveryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="font-medium text-text-secondary">{label}</span>
      <span className="text-right font-semibold text-text-primary">{children}</span>
    </div>
  )
}

/**
 * Where the order goes and what delivery costs, from the shopper's own default
 * address. With no address the API has nothing to quote, so the box says so
 * and offers to add one rather than showing a made-up fee or address.
 */
function DeliverySidebar({
  address,
  deliveryFee,
  deliveryFeeMoney,
  deliveryEstimate,
  itemPrice,
  itemPriceMoney,
  onChangeAddress,
}: {
  address: DefaultAddress | null
  deliveryFee: string
  deliveryFeeMoney: { amount: number; currency: string } | null
  deliveryEstimate: string
  itemPrice: string
  itemPriceMoney: { amount: number; currency: string } | null
  /** Takes the user to the addresses page to set or change a default address. */
  onChangeAddress: () => void
}) {
  const isFree = deliveryFeeMoney?.amount === 0
  // Only summed when both sides are in the same currency, which they are for a
  // quoted product; anything else falls back to the item price alone.
  const estimatedTotal =
    deliveryFeeMoney && itemPriceMoney && deliveryFeeMoney.currency === itemPriceMoney.currency
      ? formatAmount({
          amount: itemPriceMoney.amount + deliveryFeeMoney.amount,
          currency: itemPriceMoney.currency,
        })
      : null

  return (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden bg-bg-primary xl:w-90 xl:rounded-card xl:border xl:border-border-primary">
      <div className="border-b border-border-primary py-4 xl:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-base font-bold text-text-primary">
            <TruckLineIcon className="size-5 text-brand" aria-hidden />
            Delivery
          </p>
          <button
            type="button"
            onClick={onChangeAddress}
            className="group flex cursor-pointer items-center gap-0.5 text-sm font-semibold text-brand hover:text-brand-dark"
          >
            {address ? 'Change' : 'Add address'}
            <ArrowRightSLineIcon className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>
        </div>
        <div className="flex flex-col gap-3 rounded-xl bg-bg-secondary p-3">
          {address ? (
            <div className="flex items-start gap-2 text-sm text-text-primary">
              <MapPin2LineIcon className="mt-0.5 size-4 shrink-0 text-text-tertiary" aria-hidden />
              <div className="min-w-0">
                {address.contactName ? <p className="font-semibold">{address.contactName}</p> : null}
                {address.line1 ? <p>{address.line1}</p> : null}
                {address.line2 ? <p>{address.line2}</p> : null}
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              Add a delivery address to see the delivery fee and arrival date for this item.
            </p>
          )}
          <div className="flex flex-col gap-2 border-t border-border-secondary pt-3">
            <DeliveryRow label="Delivery fee">
              {isFree ? (
                <span className="text-primary-green">Free</span>
              ) : (
                deliveryFee || <span className="font-medium text-text-tertiary">Calculated at checkout</span>
              )}
            </DeliveryRow>
            <DeliveryRow label="Estimated arrival">
              {deliveryEstimate || <span className="font-medium text-text-tertiary">Shown at checkout</span>}
            </DeliveryRow>
          </div>
        </div>
      </div>

      <div className="border-b border-border-primary py-4 xl:p-4">
        <div className="flex flex-col gap-2">
          <DeliveryRow label="Item price">{itemPrice}</DeliveryRow>
          <DeliveryRow label="Delivery">
            {isFree ? 'Free' : deliveryFee || <span className="font-medium text-text-tertiary">At checkout</span>}
          </DeliveryRow>
          <div className="flex items-center justify-between gap-2 pt-1 text-base font-bold text-text-primary">
            <span>{estimatedTotal ? 'Estimated total' : 'Subtotal'}</span>
            <span className="tabular-price text-right">{estimatedTotal ?? itemPrice}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 py-4 xl:p-4">
        <div className="flex items-center gap-2">
          <p className="text-base font-bold text-text-primary">
            Order Protection
          </p>
          <ArrowRightSLineIcon className="size-5 text-text-secondary" aria-hidden />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1">
            <ShieldCheckLineIcon className="size-5 shrink-0 text-primary-green" aria-hidden />
            <p className="text-sm font-medium leading-4 tracking-[-0.28px] text-text-primary">
              Secure payments
            </p>
          </div>
          <p className="text-xs leading-4 tracking-[-0.24px] text-text-secondary">
            Every payment you make on olloo is secured with strict SSL encryption and PCI DSS data
            protection protocols
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1">
            <Refund2LineIcon className="size-5 shrink-0 text-primary-green" aria-hidden />
            <p className="text-sm font-medium leading-4 tracking-[-0.28px] text-text-primary">
              Refund policy
            </p>
          </div>
          <p className="text-xs leading-4 tracking-[-0.24px] text-text-secondary">
            Claim a refund if your order isn&apos;t dispatched, goes missing, or arrives with product issues
          </p>
        </div>
      </div>
    </aside>
  )
}

export function ProductDetailView({
  context,
  deliveryAddress,
  onGoHome,
  onBackToListing,
  onGoToCart,
  onProductSelect,
}: ProductDetailViewProps) {
  const { detail, selection } = context
  const { product } = detail
  const { categories } = useCatalog()
  const navigate = useNavigate()
  const {
    isLiked: isProductLiked,
    toggleWishlist,
    addToCart,
    findCartItemForProduct,
    updateCartItem,
  } = useShop()
  const { share, status: shareStatus } = useShareLink()

  const [quantity, setQuantity] = useState(1)
  const variantState = useProductDetailSelection(detail)
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([])
  const [reviews, setReviews] = useState<ProductReview[]>(detail.reviews)
  const [myReview, setMyReview] = useState<ProductReview | null>(null)
  const [reviewTotal, setReviewTotal] = useState(0)
  const [reviewPage, setReviewPage] = useState(1)
  const [isLoadingMoreReviews, setIsLoadingMoreReviews] = useState(false)
  const { authUser } = useAuth()
  const isSignedIn = authUser !== null

  const isLiked = isProductLiked(product.id)
  // Related cards show delivery quotes, which need a known destination.
  const { country } = useProductDestination()

  useEffect(() => {
    document.title = `${product.name} | olloo`
  }, [product.name])

  useEffect(() => {
    let cancelled = false

    async function loadProductExtras() {
      try {
        const [relatedResponse, reviewsResponse] = await Promise.all([
          catalogApi.getRelatedProducts(product.id, { country }),
          catalogApi.getProductReviews(product.id, 1, REVIEWS_PAGE_SIZE, { signedIn: isSignedIn }),
        ])

        if (!cancelled) {
          setRelatedProducts(relatedResponse.items.map(mapApiProduct))
          // The API sends `createdAt` instead of a preformatted `date` string.
          setReviews(reviewsResponse.reviews.map(mapApiProductReview))
          setReviewTotal(reviewsResponse.total)
          setReviewPage(1)
          setMyReview(
            reviewsResponse.myReview
              ? { ...mapApiProductReview(reviewsResponse.myReview), status: reviewsResponse.myReview.status }
              : null,
          )
        }
      } catch {
        if (!cancelled) {
          setRelatedProducts([])
          setReviews(detail.reviews)
        }
      }
    }

    void loadProductExtras()

    return () => {
      cancelled = true
    }
  }, [country, detail.reviews, isSignedIn, product.id])

  const loadMoreReviews = async () => {
    setIsLoadingMoreReviews(true)
    try {
      const next = reviewPage + 1
      const response = await catalogApi.getProductReviews(product.id, next, REVIEWS_PAGE_SIZE, {
        signedIn: isSignedIn,
      })
      setReviews((current) => [...current, ...response.reviews.map(mapApiProductReview)])
      setReviewPage(next)
    } finally {
      setIsLoadingMoreReviews(false)
    }
  }

  const reviewsSectionProps = {
    reviewCount: detail.reviewCount,
    ratingValue: detail.ratingValue,
    reviews,
    myReview,
    canLoadMore: reviews.length < reviewTotal,
    isLoadingMore: isLoadingMoreReviews,
    onLoadMore: () => void loadMoreReviews(),
  }

  const selectedVariantId = variantState.selectedVariant?.rid

  const handleAddToCart = () => {
    if (!variantState.inStock) return
    // A failure is reported by the add-to-cart notice, so it is not rethrown here.
    addToCart(product, quantity, selectedVariantId).catch(() => undefined)
  }

  const handleBuyNow = async () => {
    // Buy Now must not stack a second line for a product already in the cart,
    // so an existing line is topped up to the chosen quantity instead.
    const existingItem = findCartItemForProduct(product, selectedVariantId)
    try {
      if (existingItem) {
        await updateCartItem(existingItem.id, { quantity: existingItem.quantity + quantity })
      } else {
        // Buy Now opens the cart straight away, so no add-to-cart notice.
        await addToCart(product, quantity, selectedVariantId, { notify: false })
      }
    } catch {
      // Cart stayed unchanged; still take the user to the cart so they can see why.
    }
    onGoToCart()
  }

  // The shipping sidebar quotes delivery for the default address, so changing it
  // is an account-level task: take the user to the addresses page rather than
  // offering a picker with nowhere to persist the choice.
  const handleChangeAddress = () => {
    navigate(getAccountPath('addresses'))
  }

  // Shares the product's own page. The URL is built from the current path so the
  // recipient lands on this product, with a trailing-slash/search cleanup to
  // avoid copying a URL that is not what the address bar shows.
  const handleShare = () => {
    const shareUrl = window.location.href
    void share({
      title: product.name,
      text: product.name,
      url: shareUrl,
    })
  }

  return (
    <>
      <ProductDetailBreadcrumbs
        categoryLabel={selection.categoryLabel}
        subcategoryLabel={selection.subcategoryLabel}
        productName={product.name}
        onGoHome={onGoHome}
        onBackToListing={onBackToListing}
      />

      <section className="border-t border-border-primary px-4 pb-10 pt-6 lg:px-16 lg:pt-10">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-4 xl:max-w-132">
            <ProductImageGallery
              images={detail.images}
              productName={product.name}
              activeIndex={variantState.galleryIndex}
              onActiveIndexChange={variantState.setGalleryIndex}
            />
            <div className="hidden xl:block">
              <ProductReviewsSection {...reviewsSectionProps} />
            </div>
          </div>

          <ProductInfoPanel
            product={product}
            detail={detail}
            isLiked={isLiked}
            onToggleLike={() => toggleWishlist(product)}
            variantTitle={variantState.variantTitle}
            optionGroups={detail.optionGroups}
            selections={variantState.selections}
            onSelectOption={variantState.selectOption}
            isOptionDisabled={variantState.isOptionDisabled}
            showLegacyVariantRow={variantState.showLegacyVariantRow}
            legacyVariantNames={detail.variants.map((variant) => variant.name)}
            legacyVariantIndex={variantState.legacyVariantIndex}
            onSelectLegacyVariant={variantState.selectLegacyVariant}
            showVariantPicker={
              variantState.showOptionGroups || variantState.showLegacyVariantRow
            }
            displayPriceAmount={variantState.displayPriceAmount}
            displayPriceCurrency={variantState.displayPriceCurrency}
            inStock={variantState.inStock}
            quantity={quantity}
            onDecreaseQuantity={() => setQuantity((value) => Math.max(1, value - 1))}
            onIncreaseQuantity={() => setQuantity((value) => value + 1)}
            onAddToCart={handleAddToCart}
            onBuyNow={() => void handleBuyNow()}
            onShare={handleShare}
            shareStatus={shareStatus}
            onSelectFamilyOption={(rid) =>
              navigate(getProductPathForListingSelection(rid, selection, categories))
            }
          />

          <DeliverySidebar
            address={deliveryAddress}
            deliveryFee={detail.shippingFee}
            deliveryFeeMoney={detail.deliveryFeeMoney}
            deliveryEstimate={detail.deliveryEstimate}
            itemPrice={detail.itemsTotal}
            itemPriceMoney={
              product.priceAmount !== undefined && product.priceCurrency
                ? { amount: product.priceAmount, currency: product.priceCurrency }
                : null
            }
            onChangeAddress={handleChangeAddress}
          />

          <div className="xl:hidden">
            <ProductReviewsSection {...reviewsSectionProps} />
          </div>
        </div>
      </section>

      <section className="border-t border-border-primary px-4 py-6 lg:px-16 lg:py-10">
        <h2 className="font-display mb-4 text-xl font-bold tracking-[-0.02em] text-text-primary lg:mb-6 lg:text-[28px]">
          You may also like
        </h2>
        <div className="grid grid-cols-2 items-stretch gap-2.5 sm:grid-cols-3 lg:grid-cols-4 lg:gap-3 xl:grid-cols-5">
          {relatedProducts.map((relatedProduct) => (
            <ProductCard
              key={relatedProduct.id}
              product={relatedProduct}
              enableAddButton
              to={getProductPathForListingSelection(relatedProduct.id, selection, categories)}
              onClick={() => onProductSelect(relatedProduct)}
            />
          ))}
        </div>
      </section>
    </>
  )
}
