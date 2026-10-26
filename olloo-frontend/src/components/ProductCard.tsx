import { Link } from 'react-router-dom'
import HeartFillIcon from 'remixicon-react/HeartFillIcon'
import HeartLineIcon from 'remixicon-react/HeartLineIcon'
import ShoppingCart2LineIcon from 'remixicon-react/ShoppingCart2LineIcon'
import StarFillIcon from 'remixicon-react/StarFillIcon'
import { useShop } from '../context/ShopContext'
import { formatCompactCount, splitDisplayPrice } from '../data/format'
import type { Product } from '../data/products'

type ProductCardProps = {
  product: Product
  enableAddButton?: boolean
  to?: string
  onClick?: () => void
  isLiked?: boolean
  onLikedChange?: (liked: boolean) => void
  selectionMode?: {
    selected: boolean
    onSelectedChange: (selected: boolean) => void
  }
}

export function ProductCard({
  product,
  enableAddButton = false,
  to,
  onClick,
  isLiked: controlledIsLiked,
  onLikedChange,
  selectionMode,
}: ProductCardProps) {
  const { isLiked: isProductLiked, toggleWishlist, addToCart } = useShop()
  const {
    image,
    tag,
    category,
    name,
    price,
    originalPrice,
    discount,
    delivery,
    rating,
    reviewCount,
    soldCount,
    showAddButton = false,
    priceOrange = false,
    imageObjectPosition,
    inStock,
  } = product

  const isLiked = controlledIsLiked ?? isProductLiked(product.id)
  // `inStock` is only false when the API says so; older payloads omit it.
  const isSoldOut = inStock === false
  const shouldShowAddButton =
    !selectionMode && !isSoldOut && (enableAddButton || showAddButton)
  const ratingValue = Number.parseFloat(rating)
  const hasRating = Number.isFinite(ratingValue) && ratingValue > 0
  const { currency, amount } = splitDisplayPrice(price)

  const handleToggleLike = () => {
    if (onLikedChange) {
      onLikedChange(!isLiked)
      return
    }
    toggleWishlist(product)
  }

  // The whole card is a <Link>, so the anchor's default navigation must be
  // cancelled as well as the click from bubbling. stopPropagation alone leaves
  // the browser free to follow the href and jump to the product page.
  const handleAddToCart = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    // A failure is reported by the add-to-cart notice, so it is not rethrown here.
    addToCart(product).catch(() => undefined)
  }

  const handleCardClick = () => {
    onClick?.()
  }

  const cardClassName = `group/card flex h-full w-full min-w-0 max-w-full flex-col overflow-hidden rounded-card border border-border-primary bg-bg-primary transition-[box-shadow,border-color,transform] duration-300 hover:border-transparent hover:shadow-card ${
    onClick || to ? 'cursor-pointer' : ''
  }`

  const cardContent = (
    <>
      <div className="relative aspect-square w-full overflow-hidden bg-bg-secondary">
        <img
          alt=""
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover/card:scale-[1.04] ${
            isSoldOut ? 'opacity-60 grayscale' : ''
          } ${imageObjectPosition ?? ''}`}
          src={image}
        />

        {/* Badges stack top-left; the wishlist control owns the top-right corner. */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 lg:p-2.5">
          <div className="flex min-w-0 flex-col items-start gap-1">
            {discount && !selectionMode ? (
              <span className="tabular-price rounded-md bg-primary-red px-1.5 py-0.5 text-xs font-bold text-text-inverse">
                {discount}
              </span>
            ) : null}
            {tag && !selectionMode ? (
              <span className="hidden max-w-full truncate rounded-md bg-bg-primary/90 px-1.5 py-0.5 text-[11px] font-semibold text-text-primary backdrop-blur-sm sm:block">
                {tag}
              </span>
            ) : null}
          </div>

          {selectionMode ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                selectionMode.onSelectedChange(!selectionMode.selected)
              }}
              className={`flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 ${
                selectionMode.selected
                  ? 'border-brand bg-brand'
                  : 'border-border-secondary bg-bg-primary'
              }`}
              aria-label={selectionMode.selected ? 'Deselect product' : 'Select product'}
              aria-pressed={selectionMode.selected}
            >
              {selectionMode.selected ? (
                <span className="size-3 rounded-full bg-bg-primary" aria-hidden />
              ) : null}
            </button>
          ) : (
            <button
              type="button"
              onClick={(event) => {
                // preventDefault is required as well: the card is a <Link>, and
                // stopping propagation alone still lets the browser follow the
                // anchor href, which is what navigated away from the page.
                event.preventDefault()
                event.stopPropagation()
                handleToggleLike()
              }}
              className={`flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-bg-primary shadow-[0_2px_8px_rgba(21,17,43,0.12)] transition-transform hover:scale-105 active:scale-95 ${
                isLiked ? '' : 'lg:opacity-0 lg:group-hover/card:opacity-100 lg:focus-visible:opacity-100'
              }`}
              aria-label={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
              aria-pressed={isLiked}
            >
              {isLiked ? (
                <HeartFillIcon className="size-5 text-primary-red" aria-hidden />
              ) : (
                <HeartLineIcon className="size-5 text-text-primary" aria-hidden />
              )}
            </button>
          )}
        </div>

        {isSoldOut ? (
          <span className="absolute inset-x-2 bottom-2 rounded-md bg-ink/80 py-1 text-center text-xs font-semibold text-text-inverse">
            Sold out
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2.5 lg:p-3">
        <p className="truncate text-xs font-medium text-text-tertiary">{category}</p>
        <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-text-primary">
          {name}
        </p>

        {hasRating ? (
          <div className="flex min-w-0 items-center gap-1 text-xs text-text-secondary">
            <StarFillIcon className="size-3.5 shrink-0 text-primary-gold" aria-hidden />
            <span className="font-semibold text-text-primary">{ratingValue.toFixed(1)}</span>
            {reviewCount ? (
              <span className="text-text-tertiary">({formatCompactCount(reviewCount)})</span>
            ) : null}
            {soldCount ? (
              <>
                <span aria-hidden className="text-border-secondary">
                  |
                </span>
                <span className="truncate">{formatCompactCount(soldCount)} sold</span>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div className="flex min-w-0 flex-col">
            <p
              className={`tabular-price flex items-baseline gap-1 font-bold leading-tight ${
                priceOrange || selectionMode ? 'text-brand' : 'text-text-primary'
              }`}
            >
              {currency ? <span className="text-xs font-semibold">{currency}</span> : null}
              <span className="text-base sm:text-lg">{amount}</span>
            </p>
            {originalPrice ? (
              <p className="tabular-price truncate text-xs font-medium text-text-tertiary line-through">
                {originalPrice}
              </p>
            ) : null}
          </div>

          {shouldShowAddButton ? (
            <button
              type="button"
              onClick={handleAddToCart}
              className="btn-brand flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full shadow-[0_6px_16px_-6px_rgba(91,43,224,0.7)] transition-transform hover:scale-105 active:scale-95 lg:size-10"
              aria-label={`Add ${name} to cart`}
            >
              <ShoppingCart2LineIcon className="size-4.5 text-text-inverse lg:size-5" aria-hidden />
            </button>
          ) : null}
        </div>

        {delivery ? (
          <p className="truncate text-xs font-semibold text-primary-green">{delivery}</p>
        ) : null}
      </div>
    </>
  )

  if (to) {
    return (
      <Link to={to} onClick={handleCardClick} className={cardClassName}>
        {cardContent}
      </Link>
    )
  }

  return (
    <article
      className={cardClassName}
      onClick={onClick ? handleCardClick : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handleCardClick()
              }
            }
          : undefined
      }
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {cardContent}
    </article>
  )
}
