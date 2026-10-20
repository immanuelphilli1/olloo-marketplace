import { Link } from 'react-router-dom'
import AddLineIcon from 'remixicon-react/AddLineIcon'
import HeartFillIcon from 'remixicon-react/HeartFillIcon'
import HeartLineIcon from 'remixicon-react/HeartLineIcon'
import StarFillIcon from 'remixicon-react/StarFillIcon'
import { useShop } from '../context/ShopContext'
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
    showAddButton = false,
    priceOrange = false,
    imageObjectPosition,
  } = product

  const isLiked = controlledIsLiked ?? isProductLiked(product.id)
  const shouldShowAddButton = !selectionMode && (enableAddButton || showAddButton)

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
    addToCart(product)
  }

  const handleCardClick = () => {
    onClick?.()
  }

  const cardClassName = `group/card flex h-full w-full min-w-0 max-w-full flex-col overflow-hidden rounded-[12px] border border-border-primary p-2 ${
    onClick || to ? 'cursor-pointer' : ''
  }`

  const cardContent = (
    <>
      <div className="relative flex aspect-square w-full flex-col justify-between overflow-hidden rounded-lg">
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-lg">
          <div className="absolute inset-0 rounded-lg bg-[#1da1f2]" />
          <img
            alt=""
            className={`absolute size-full max-w-none rounded-lg object-cover ${imageObjectPosition ?? ''}`}
            src={image}
          />
        </div>

        <div className="relative flex w-full items-start justify-between p-3">
          {selectionMode ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                selectionMode.onSelectedChange(!selectionMode.selected)
              }}
              className={`flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 lg:size-8 ${
                selectionMode.selected
                  ? 'border-primary-orange bg-primary-orange'
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
            <>
              <div className="h-6 w-18 shrink-0 lg:hidden" aria-hidden />
              <div className="hidden rounded-full px-2 py-1 lg:block">
                <p className="truncate text-xs font-medium tracking-[-0.24px] text-text-inverse">
                  {tag}
                </p>
              </div>
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
                className={`flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors ${
                  isLiked ? 'bg-primary-orange/50' : 'bg-glass hover:bg-primary-orange/50'
                }`}
                aria-label={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
                aria-pressed={isLiked}
              >
                {isLiked ? (
                  <HeartFillIcon className="size-5 text-primary-red" aria-hidden />
                ) : (
                  <HeartLineIcon className="size-5 text-text-inverse" aria-hidden />
                )}
              </button>
            </>
          )}
        </div>

        <div className="relative hidden p-3 lg:p-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-glass px-2 py-1">
            <StarFillIcon className="size-5 text-primary-gold" aria-hidden />
            <span className="text-base font-medium tracking-[-0.32px] text-text-inverse">
              {rating}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-1 py-1.5 lg:gap-2 lg:py-2">
        <p className="text-sm font-medium tracking-[-0.28px] text-text-secondary">{category}</p>
        <p className="line-clamp-2 text-base font-semibold tracking-[-0.32px] text-text-primary lg:min-h-10">
          {name}
        </p>
        <div className="mt-auto flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p
              className={`text-base font-semibold tracking-[-0.32px] sm:text-xl sm:tracking-[-0.4px] ${
                priceOrange || selectionMode ? 'text-primary-orange' : 'text-text-primary'
              }`}
            >
              {price}
            </p>
            {originalPrice && (
              <p className="text-sm font-medium tracking-[-0.28px] text-text-tertiary line-through sm:text-base sm:tracking-[-0.32px]">
                {originalPrice}
              </p>
            )}
            {discount && (
              <span className="rounded-full bg-red-light px-2 py-1 text-xs font-medium tracking-[-0.24px] text-primary-red">
                {discount}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 text-sm font-medium tracking-[-0.28px] text-primary-green">
              {delivery}
            </p>
            {shouldShowAddButton && (
              <button
                type="button"
                onClick={handleAddToCart}
                className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary-orange transition-[opacity,background-color] duration-300 hover:bg-primary-orange/80 lg:size-12 lg:pointer-events-none lg:opacity-0 lg:group-hover/card:pointer-events-auto lg:group-hover/card:opacity-100"
                aria-label="Add to cart"
              >
                <AddLineIcon className="size-5 text-text-inverse lg:size-6" aria-hidden />
              </button>
            )}
          </div>
        </div>
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
