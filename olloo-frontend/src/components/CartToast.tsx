import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CheckboxCircleFillIcon from 'remixicon-react/CheckboxCircleFillIcon'
import CloseLineIcon from 'remixicon-react/CloseLineIcon'
import ErrorWarningFillIcon from 'remixicon-react/ErrorWarningFillIcon'
import { useShop } from '../context/ShopContext'
import { getCartPath } from '../data/shopRoutes'

/** How long a notice stays up before it dismisses itself. */
const VISIBLE_MS = 4000

/**
 * Confirms every add-to-cart, wherever it happened (product cards, the product
 * page), with a shortcut to the cart; a failed add shows its reason instead.
 *
 * Desktop: under the header on the right. Phones: just above the tab bar, where
 * the thumb already is. The timer pauses while the pointer or focus is on the
 * notice, so it never vanishes mid-click, and it is announced politely to
 * screen readers.
 */
export function CartToast() {
  const { cartNotice, dismissCartNotice, cartItemCount } = useShop()
  const navigate = useNavigate()
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    if (!cartNotice || isPaused) return

    const timer = window.setTimeout(dismissCartNotice, VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [cartNotice, dismissCartNotice, isPaused])

  if (!cartNotice) return null

  const isAdded = cartNotice.kind === 'added'

  return (
    <div
      role="status"
      aria-live="polite"
      // Keyed by notice id so each add replays the entrance animation.
      key={cartNotice.id}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      className="fixed inset-x-3 bottom-24 z-[60] motion-safe:animate-toast-in lg:inset-x-auto lg:bottom-auto lg:right-8 lg:top-[calc(var(--nav-height,8rem)+12px)] lg:w-96"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-border-primary bg-bg-primary p-3 shadow-float">
        {isAdded ? (
          <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-bg-secondary">
            {cartNotice.image ? (
              <img alt="" src={cartNotice.image} className="absolute inset-0 size-full object-cover" />
            ) : null}
            <CheckboxCircleFillIcon
              className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-bg-primary text-primary-green"
              aria-hidden
            />
          </span>
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-light text-primary-red">
            <ErrorWarningFillIcon className="size-5" aria-hidden />
          </span>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className={`text-sm font-bold ${isAdded ? 'text-primary-green' : 'text-primary-red'}`}>
            {isAdded ? 'Added to cart' : 'Couldn’t add to cart'}
          </p>
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary">
            {cartNotice.productName}
          </p>
          {isAdded ? (
            <p className="tabular-price text-xs text-text-secondary">
              {cartNotice.quantity > 1 ? `${cartNotice.quantity} × ` : ''}
              {cartNotice.price}
              <span className="text-text-tertiary">
                {' '}
                · {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'} in cart
              </span>
            </p>
          ) : (
            <p className="text-xs text-text-secondary">{cartNotice.message}</p>
          )}
          {isAdded ? (
            <button
              type="button"
              onClick={() => {
                dismissCartNotice()
                navigate(getCartPath())
                window.scrollTo({ top: 0 })
              }}
              className="btn-brand mt-1.5 flex h-9 w-fit cursor-pointer items-center rounded-full px-4 text-xs font-bold text-text-inverse transition-opacity hover:opacity-90"
            >
              View cart
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={dismissCartNotice}
          aria-label="Dismiss"
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-bg-secondary hover:text-text-primary"
        >
          <CloseLineIcon className="size-4.5" aria-hidden />
        </button>
      </div>
    </div>
  )
}
