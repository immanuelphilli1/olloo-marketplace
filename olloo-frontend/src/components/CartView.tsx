import { useEffect, useMemo } from 'react'
import DeleteBin7LineIcon from 'remixicon-react/DeleteBin7LineIcon'
import type { CartItem } from '../data/cart'
import { formatAmountDecimal } from '../data/format'
import { useShop } from '../context/ShopContext'
import { useRecommendations } from '../hooks/useCatalogProducts'
import { OrderSummaryPanel } from './OrderSummaryPanel'
import { ListingLoader } from './ListingLoader'
import { PageBreadcrumbs } from './PageBreadcrumbs'
import { ProductCard } from './ProductCard'
import { QuantityStepper } from './QuantityStepper'

type CartViewProps = {
  onGoHome: () => void
  onCheckout: () => void
  onGoToProduct: (productId: string) => void
}

function CartCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-label={label}
      aria-pressed={checked}
      className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-border-secondary bg-bg-primary"
    >
      {checked ? <span className="size-4 rounded-full bg-text-primary" aria-hidden /> : null}
    </button>
  )
}

function CartItemRow({
  item,
  onToggleSelected,
  onDelete,
  onDecrease,
  onIncrease,
  onGoToProduct,
}: {
  item: CartItem
  onToggleSelected: () => void
  onDelete: () => void
  onDecrease: () => void
  onIncrease: () => void
  onGoToProduct: () => void
}) {
  return (
    <article className="border-b border-border-primary py-4">
      {item.available === false ? (
        <p
          role="alert"
          className="mb-3 rounded-lg bg-orange-light px-3 py-2 text-xs font-medium leading-4 tracking-[-0.24px] text-primary-orange"
        >
          This item is no longer available. Remove it to continue.
        </p>
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-4">
        <div className="flex gap-4">
          <CartCheckbox
            checked={item.selected}
            onChange={onToggleSelected}
            label={`Select ${item.name}`}
          />
          <button
            type="button"
            onClick={onGoToProduct}
            aria-label={`View ${item.name}`}
            className="size-20 shrink-0 cursor-pointer overflow-hidden rounded-[11px] border border-border-primary bg-bg-secondary lg:size-36"
          >
            <img alt="" className="size-full object-cover" src={item.image} />
          </button>
          <div className="min-w-0 flex-1 lg:hidden">
            <div className="flex items-start gap-2">
              <p className="line-clamp-3 flex-1 text-sm leading-4.5 tracking-[-0.28px] text-text-secondary">
                {item.name}
              </p>
              <button
                type="button"
                onClick={onDelete}
                aria-label="Remove item"
                className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-bg-secondary"
              >
                <DeleteBin7LineIcon className="size-5 text-text-secondary" aria-hidden />
              </button>
            </div>
            <span className="mt-4 inline-flex rounded-lg border border-text-primary bg-bg-secondary px-2 py-1 text-xs font-medium leading-4 tracking-[-0.24px] text-text-primary">
              {item.variant}
            </span>
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 lg:block">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={onGoToProduct}
              className="min-w-0 flex-1 cursor-pointer text-left"
            >
              <p className="line-clamp-2 text-base leading-5 tracking-[-0.32px] text-text-secondary">
                {item.name}
              </p>
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="Remove item"
              className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-bg-secondary"
            >
              <DeleteBin7LineIcon className="size-5 text-text-secondary" aria-hidden />
            </button>
          </div>
          <span className="mt-4 inline-flex rounded-lg border border-text-primary bg-bg-secondary px-2 py-1 text-xs font-medium leading-4 tracking-[-0.24px] text-text-primary">
            {item.variant}
          </span>
          <div className="mt-8 flex items-center justify-between">
            <div className="flex flex-col">
              <div className="flex items-center gap-1 text-text-primary">
                <span className="text-sm leading-4.5 tracking-[-0.28px]">{item.currency}</span>
                <span className="text-xl font-semibold leading-6 tracking-[-0.4px]">
                  {formatAmountDecimal(item.price)}
                </span>
              </div>
              <CartPriceChangeNotice item={item} />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-primary">
                QTY
              </span>
              <QuantityStepper
                quantity={item.quantity}
                onDecrease={onDecrease}
                onIncrease={onIncrease}
                max={getMaxQuantity(item)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between lg:hidden">
        <div className="flex flex-col">
          <div className="flex items-center gap-1 text-text-primary">
            <span className="text-sm leading-4.5 tracking-[-0.28px]">{item.currency}</span>
            <span className="text-xl font-semibold leading-6 tracking-[-0.4px]">
              {formatAmountDecimal(item.price)}
            </span>
          </div>
          <CartPriceChangeNotice item={item} />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-primary">
            QTY
          </span>
          <QuantityStepper
            quantity={item.quantity}
            onDecrease={onDecrease}
            onIncrease={onIncrease}
            max={getMaxQuantity(item)}
          />
        </div>
      </div>
    </article>
  )
}

/**
 * Flags a line whose price moved since it was added, and shows the new figure.
 *
 * The cart prices every line at today's price, so without this the shopper would
 * only discover the change when `POST /orders` rejected the attempt.
 */
function CartPriceChangeNotice({ item }: { item: CartItem }) {
  // Absent, or equal, means the price has not moved.
  if (item.previousPrice === undefined || item.previousPrice === item.price) return null

  return (
    <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs leading-4 tracking-[-0.24px] text-primary-orange">
      <span className="font-medium">Price changed</span>
      <span className="text-text-secondary line-through">
        {item.currency} {formatAmountDecimal(item.previousPrice)}
      </span>
      <span aria-hidden className="text-text-secondary">
        &rarr;
      </span>
      <span className="font-medium text-text-primary">
        {item.currency} {formatAmountDecimal(item.price)}
      </span>
    </p>
  )
}

/** Caps the stepper at the stock on hand when the variant is stock-tracked. */
function getMaxQuantity(item: CartItem): number | undefined {
  // `null` means made-to-order: never sells out, so there is no cap.
  if (item.stockQuantity === null || item.stockQuantity === undefined) return undefined
  return Math.max(1, item.stockQuantity)
}

export function CartView({ onGoHome, onCheckout, onGoToProduct }: CartViewProps) {
  const {
    cartItems,
    isCartLoading,
    cartError,
    clearCartError,
    updateCartItem,
    removeCartItem,
    removeSelectedCartItems,
    selectAllCartItems,
    moveSelectedToWishlist,
  } = useShop()
  const recommendationProducts = useRecommendations('cart')

  useEffect(() => {
    document.title = 'Cart | H&CO.'
  }, [])

  const selectedCount = useMemo(() => cartItems.filter((item) => item.selected).length, [cartItems])
  const allSelected = cartItems.length > 0 && selectedCount === cartItems.length

  // Cart mutations reject on a 422 (e.g. exceeding stock). The context has
  // already surfaced the reason in `cartError`, so the rejection is swallowed
  // here rather than becoming an unhandled promise.
  const runCartAction = (action: () => Promise<void>) => {
    clearCartError()
    void action().catch(() => undefined)
  }

  const toggleAll = () => {
    runCartAction(() => selectAllCartItems(!allSelected))
  }

  const deleteSelected = () => {
    runCartAction(removeSelectedCartItems)
  }

  const moveSelected = () => {
    runCartAction(moveSelectedToWishlist)
  }

  return (
    <>
      <PageBreadcrumbs
        onGoBack={onGoHome}
        segments={[
          { label: 'Home', onClick: onGoHome },
          { label: 'Cart' },
        ]}
      />

      <section className="border-t border-border-primary px-4 pb-10 pt-6 lg:px-16 lg:pt-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-4">
          <div className="min-w-0 flex-1">
            {cartError ? (
              <p
                role="alert"
                className="mb-4 rounded-xl bg-orange-light px-4 py-3 text-sm font-medium leading-4.5 tracking-[-0.28px] text-primary-orange"
              >
                {cartError}
              </p>
            ) : null}
            <div className="overflow-hidden rounded-2xl border border-border-primary bg-bg-primary">
              <div className="flex items-center gap-2 border-b border-border-primary px-4 py-4 lg:px-4">
                <CartCheckbox
                  checked={allSelected}
                  onChange={toggleAll}
                  label="Select all items"
                />
                <p className="min-w-0 flex-1 text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
                  Select all ({cartItems.length})
                </p>
                <div className="hidden items-center gap-2 lg:flex">
                  <button
                    type="button"
                    onClick={deleteSelected}
                    className="cursor-pointer rounded-full bg-bg-secondary px-4 py-2 text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-primary"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={moveSelected}
                    className="cursor-pointer rounded-full bg-bg-secondary px-4 py-2 text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-primary"
                  >
                    Move to wishlist
                  </button>
                </div>
              </div>

              <div className="px-4">
                {isCartLoading ? (
                  <ListingLoader label="Loading your cart" />
                ) : cartItems.length === 0 ? (
                  <div className="flex min-h-48 flex-col items-center justify-center gap-2 py-10 text-center">
                    <p className="text-xl font-medium leading-6 tracking-[-0.4px] text-text-primary">
                      Your cart is empty
                    </p>
                    <p className="text-sm font-medium leading-4 tracking-[-0.28px] text-text-secondary">
                      Add products to start checkout.
                    </p>
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <CartItemRow
                      key={item.id}
                      item={item}
                      onToggleSelected={() =>
                        runCartAction(() =>
                          updateCartItem(item.id, { selected: !item.selected }),
                        )
                      }
                      onDelete={() => runCartAction(() => removeCartItem(item.id))}
                      onDecrease={() =>
                        runCartAction(() =>
                          updateCartItem(item.id, {
                            quantity: Math.max(1, item.quantity - 1),
                          }),
                        )
                      }
                      onIncrease={() =>
                        runCartAction(() =>
                          updateCartItem(item.id, { quantity: item.quantity + 1 }),
                        )
                      }
                      onGoToProduct={() => {
                        if (item.productRid) onGoToProduct(item.productRid)
                      }}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="mt-8 lg:hidden">
              <OrderSummaryPanel mode="cart" onPrimaryAction={onCheckout} />
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="mb-4 rounded-2xl border border-border-primary bg-bg-primary p-4">
              <p className="text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
                All items({cartItems.length})
              </p>
            </div>
            <OrderSummaryPanel mode="cart" onPrimaryAction={onCheckout} />
          </div>
        </div>

        <div className="mt-10 lg:mt-14">
          <h2 className="mb-4 text-xl font-medium leading-6 tracking-[-0.4px] text-text-primary lg:text-2xl lg:leading-8 lg:tracking-[-0.48px]">
            You may also like
          </h2>
          <div className="grid grid-cols-2 items-stretch gap-2 lg:grid-cols-5 lg:gap-2">
            {recommendationProducts.slice(0, 10).map((product, index) => (
              <ProductCard key={`${product.id}-${index}`} product={product} />
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
