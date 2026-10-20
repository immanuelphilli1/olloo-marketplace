import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { catalogApi } from '../api'
import { getAccountPath } from '../data/accountRoutes'
import { mapApiProduct, mapApiProductReview } from '../api/mappers'
import AddLineIcon from 'remixicon-react/AddLineIcon'
import ArrowLeftSLineIcon from 'remixicon-react/ArrowLeftSLineIcon'
import ArrowRightSLineIcon from 'remixicon-react/ArrowRightSLineIcon'
import HeartFillIcon from 'remixicon-react/HeartFillIcon'
import HeartLineIcon from 'remixicon-react/HeartLineIcon'
import PriceTag3LineIcon from 'remixicon-react/PriceTag3LineIcon'
import Refund2LineIcon from 'remixicon-react/Refund2LineIcon'
import ShareForwardBoxFillIcon from 'remixicon-react/ShareForwardBoxFillIcon'
import ShieldCheckLineIcon from 'remixicon-react/ShieldCheckLineIcon'
import ShieldUserFillIcon from 'remixicon-react/ShieldUserFillIcon'
import SubtractLineIcon from 'remixicon-react/SubtractLineIcon'
import User6LineIcon from 'remixicon-react/User6LineIcon'
import { useCatalog } from '../context/CatalogContext'
import { useShop } from '../context/ShopContext'
import { useProductDestination } from '../hooks/useProductDestination'
import { useShareLink } from '../hooks/useShareLink'
import type {
  ProductDetail,
  ProductDetailContext,
  ProductOptionGroup,
  ProductReview,
} from '../data/productDetail'
import { useProductDetailSelection } from '../hooks/useProductDetailSelection'
import type { Product } from '../data/products'
import { getProductPathForListingSelection } from '../data/shopRoutes'
import { ProductCard } from './ProductCard'
import { RatingStars } from './RatingStars'

type ProductDetailViewProps = {
  context: ProductDetailContext
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
            className={`relative size-18 shrink-0 cursor-pointer overflow-hidden rounded-lg border bg-bg-secondary ${
              index === activeIndex ? 'border-text-primary' : 'border-border-primary'
            }`}
            aria-label={`View image ${index + 1}`}
            aria-current={index === activeIndex}
          >
            <img alt="" className="size-full object-cover" src={image} />
          </button>
        ))}
      </div>

      <div className="flex w-full flex-col gap-4 lg:flex-1">
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border-primary bg-bg-secondary lg:max-w-110">
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
              className={`relative size-18 shrink-0 cursor-pointer overflow-hidden rounded-lg border bg-bg-secondary ${
                index === activeIndex ? 'border-text-primary' : 'border-border-primary'
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

function ProductReviewsSection({
  reviewCount,
  ratingValue,
  reviews,
}: {
  reviewCount: number
  ratingValue: number
  reviews: ProductReview[]
}) {
  return (
    <div className="overflow-hidden bg-bg-primary xl:rounded-[12px] xl:border xl:border-border-primary">
      <div className="flex items-center justify-between gap-2 border-b border-border-primary p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="text-base font-semibold leading-5 tracking-[-0.32px] text-text-primary">
            {reviewCount} reviews
          </p>
          <span className="h-4.5 w-px bg-border-secondary" aria-hidden />
          <div className="flex items-center gap-2">
            <span className="text-sm leading-4 tracking-[-0.28px] text-text-secondary">
              {ratingValue.toFixed(1)}
            </span>
            <RatingStars value={ratingValue} size="sm" />
          </div>
        </div>

        <div className="hidden shrink-0 items-center overflow-hidden rounded-full bg-green-light lg:inline-flex">
          <span className="flex items-center bg-[#004f3b] py-1 pl-1.5 pr-1">
            <ShieldUserFillIcon className="size-4 text-primary-green" aria-hidden />
          </span>
          <span className="px-2 py-1 text-xs font-medium leading-4 tracking-[-0.24px] text-primary-green">
            All reviews are from verified purchases
          </span>
        </div>

        <div
          className="inline-flex shrink-0 items-center overflow-hidden rounded-full bg-green-light lg:hidden"
          aria-label="All reviews are from verified purchases"
        >
          <span className="flex items-center bg-[#004f3b] py-1 pl-1 pr-1">
            <ShieldUserFillIcon className="size-4 text-primary-green" aria-hidden />
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {reviews.map((review, index) => (
          <div key={`${review.author}-${index}`} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-sm leading-4 tracking-[-0.28px]">
              <span className="flex size-6 items-center justify-center rounded-full bg-bg-tertiary">
                <User6LineIcon className="size-4 text-text-secondary" aria-hidden />
              </span>
              <span className="font-medium text-text-primary">{review.author}</span>
              <span className="text-text-secondary">in</span>
              <span className="font-medium text-text-primary">{review.location}</span>
              <span className="text-text-secondary">on {review.date}</span>
            </div>
            <RatingStars value={review.rating} size="sm" />
            <p className="text-sm leading-4 tracking-[-0.28px] text-text-secondary">{review.text}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-center p-4">
        <button
          type="button"
          className="flex h-10 w-full max-w-50 cursor-pointer items-center justify-center rounded-full border border-text-primary px-4 text-sm font-medium leading-4 tracking-[-0.28px] text-text-primary"
        >
          see all reviews
        </button>
      </div>
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
        className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-[#d1d3d3] disabled:cursor-not-allowed disabled:opacity-50"
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
}) {
  // `discount` is derived from the API's `discountPercent` during mapping; the
  // promotional-notice string it replaced is no longer sent, so the badge hides
  // itself when the product has no discount.
  const discountBadge = product.discount ?? ''

  return (
    <div className="min-w-0 flex-1 overflow-hidden bg-bg-primary xl:max-w-98 xl:rounded-[12px] xl:border xl:border-border-primary">
      <div className="border-b border-border-primary py-4 xl:p-4">
        <div className="mb-2 flex items-start gap-2">
          <h1 className="min-w-0 flex-1 text-xl font-semibold leading-6 tracking-[-0.4px] text-text-primary">
            {product.name}
          </h1>
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
            {detail.ratingValue.toFixed(1)}({detail.reviewCount} reviews)
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
        <div className="mb-2 flex items-center gap-1 text-text-primary">
          <span className="text-sm leading-4 tracking-[-0.28px]">{displayPriceCurrency}</span>
          <span className="text-xl font-semibold leading-6 tracking-[-0.4px]">{displayPriceAmount}</span>
        </div>
        {/* The promo notice string is deprecated, so the badge is driven by the
            real discount percentage and hidden when there is no discount. */}
        {discountBadge ? (
          <div className="inline-flex items-center gap-2 rounded-lg bg-orange-light px-2 py-1">
            <PriceTag3LineIcon className="size-4 text-primary-orange" aria-hidden />
            <span className="text-xs font-medium leading-4 tracking-[-0.24px] text-primary-orange">
              {discountBadge}
            </span>
          </div>
        ) : null}
      </div>

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
                      className={`cursor-pointer rounded-lg border px-2 py-1 text-xs font-medium leading-4 tracking-[-0.24px] disabled:cursor-not-allowed disabled:opacity-50 ${
                        isSelected
                          ? 'border-text-primary bg-bg-secondary text-text-primary'
                          : 'border-border-primary bg-bg-secondary text-text-tertiary'
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
                      className={`cursor-pointer rounded-lg border px-2 py-1 text-xs font-medium leading-4 tracking-[-0.24px] ${
                        isSelected
                          ? 'border-text-primary bg-bg-secondary text-text-primary'
                          : 'border-border-primary bg-bg-secondary text-text-tertiary'
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
          <span className="text-sm font-medium leading-4 tracking-[-0.28px] text-text-primary">QTY</span>
          <QuantityStepper
            quantity={quantity}
            onDecrease={onDecreaseQuantity}
            onIncrease={onIncreaseQuantity}
          />
        </div>
      </div>

      <div className="border-b border-border-primary py-4 xl:p-4">
        <p className="mb-2 text-sm font-medium leading-4 tracking-[-0.28px] text-text-primary">
          Product Description
        </p>
        <div className="flex flex-col gap-2 text-sm leading-4 tracking-[-0.28px] text-text-primary">
          {detail.descriptionLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>

      {product.attributes && product.attributes.length > 0 ? (
        <div className="border-t border-border-primary py-4">
          <p className="mb-3 text-sm font-medium leading-4 tracking-[-0.28px] text-text-primary">
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

      <div className="flex gap-4 py-4 xl:p-4">
        <button
          type="button"
          onClick={onAddToCart}
          disabled={!inStock}
          className="flex h-10 flex-1 cursor-pointer items-center justify-center rounded-full border border-text-primary px-4 text-sm font-medium leading-4 tracking-[-0.28px] text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {inStock ? 'Add to Cart' : 'Out of stock'}
        </button>
        <button
          type="button"
          onClick={onBuyNow}
          disabled={!inStock}
          className="btn-orange flex h-10 flex-1 cursor-pointer items-center justify-center rounded-full px-4 text-sm font-medium leading-4 tracking-[-0.28px] text-text-inverse disabled:cursor-not-allowed disabled:opacity-50"
        >
          Buy Now
        </button>
      </div>
    </div>
  )
}

function ShippingSidebar({
  shippingAddress,
  shippingFee,
  deliveryEstimate,
  itemsTotal,
  subtotal,
  onChangeAddress,
}: {
  shippingAddress: { line1: string; line2: string }
  shippingFee: string
  deliveryEstimate: string
  itemsTotal: string
  subtotal: string
  /** Takes the user to the addresses page to set or change a default address. */
  onChangeAddress: () => void
}) {
  return (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden bg-bg-primary xl:w-90 xl:rounded-[12px] xl:border xl:border-border-primary">
      <div className="border-b border-border-primary py-4 xl:p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <p className="text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">Shipping</p>
          <button
            type="button"
            onClick={onChangeAddress}
            className="group flex cursor-pointer items-center gap-1 text-sm leading-4 tracking-[-0.28px] text-text-primary"
          >
            Change
            <ArrowRightSLineIcon
              className="size-4 text-text-secondary transition-colors group-hover:text-primary-orange"
              aria-hidden
            />
          </button>
        </div>
        <div className="rounded-lg bg-bg-secondary p-2">
          <div className="mb-4 flex flex-col gap-2">
            <p className="text-sm font-medium leading-4 tracking-[-0.28px] text-text-primary">Address:</p>
            <div className="flex flex-col gap-1 text-sm leading-4 tracking-[-0.28px] text-text-primary">
              <p>{shippingAddress.line1}</p>
              <p>{shippingAddress.line2}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 text-sm leading-4 tracking-[-0.28px]">
              <span className="font-medium text-text-primary">Shipping Fee:</span>
              <span className="text-right text-text-primary">{shippingFee}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm leading-4 tracking-[-0.28px]">
              <span className="font-medium text-text-primary">Delivery:</span>
              <span className="text-right text-text-primary">{deliveryEstimate}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-border-primary py-4 xl:p-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 text-sm leading-4 tracking-[-0.28px]">
            <span className="font-medium text-text-primary">Items Total:</span>
            <span className="text-right text-text-primary">{itemsTotal}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm leading-4 tracking-[-0.28px]">
            <span className="font-medium text-text-primary">Shipping:</span>
            <span className="text-right text-text-primary">{deliveryEstimate}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
            <span>Subtotal</span>
            <span className="text-right">{subtotal}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 py-4 xl:p-4">
        <div className="flex items-center gap-2">
          <p className="text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
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
            Every payment you make on H&CO is secured with strict SSL encryption and PCI DSS data
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
            Claim a refund if your order doesn&apos;t ship, is missing, or arrives with product issues
          </p>
        </div>
      </div>
    </aside>
  )
}

export function ProductDetailView({
  context,
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

  const isLiked = isProductLiked(product.id)
  // Related cards show delivery quotes, which need a known destination.
  const { country } = useProductDestination()

  useEffect(() => {
    document.title = `${product.name} | H&CO.`
  }, [product.name])

  useEffect(() => {
    let cancelled = false

    async function loadProductExtras() {
      try {
        const [relatedResponse, reviewsResponse] = await Promise.all([
          catalogApi.getRelatedProducts(product.id, { country }),
          catalogApi.getProductReviews(product.id),
        ])

        if (!cancelled) {
          setRelatedProducts(relatedResponse.items.map(mapApiProduct))
          // The API sends `createdAt` instead of a preformatted `date` string.
          setReviews(reviewsResponse.reviews.map(mapApiProductReview))
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
  }, [country, detail.reviews, product.id])

  const selectedVariantId = variantState.selectedVariant?.rid

  const handleAddToCart = () => {
    if (!variantState.inStock) return
    void addToCart(product, quantity, selectedVariantId)
  }

  const handleBuyNow = async () => {
    // Buy Now must not stack a second line for a product already in the cart,
    // so an existing line is topped up to the chosen quantity instead.
    const existingItem = findCartItemForProduct(product, selectedVariantId)
    try {
      if (existingItem) {
        await updateCartItem(existingItem.id, { quantity: existingItem.quantity + quantity })
      } else {
        await addToCart(product, quantity, selectedVariantId)
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
              <ProductReviewsSection
                reviewCount={detail.reviewCount}
                ratingValue={detail.ratingValue}
                reviews={reviews}
              />
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
          />

          <ShippingSidebar
            shippingAddress={detail.shippingAddress}
            shippingFee={detail.shippingFee}
            deliveryEstimate={detail.deliveryEstimate}
            itemsTotal={detail.itemsTotal}
            subtotal={detail.subtotal}
            onChangeAddress={handleChangeAddress}
          />

          <div className="xl:hidden">
            <ProductReviewsSection
              reviewCount={detail.reviewCount}
              ratingValue={detail.ratingValue}
              reviews={reviews}
            />
          </div>
        </div>
      </section>

      <section className="border-t border-border-primary px-4 py-6 lg:px-16 lg:py-10">
        <h2 className="mb-4 text-xl font-medium leading-6 tracking-[-0.4px] text-text-primary lg:mb-10 lg:text-[32px] lg:leading-10 lg:tracking-[-0.64px]">
          You may also like
        </h2>
        <div className="grid grid-cols-2 items-stretch gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
