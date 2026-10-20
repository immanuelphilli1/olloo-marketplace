import { useEffect, useMemo, useRef, useState } from 'react'
import { checkoutApi } from '../api'
import type { ShippingQuote } from '../api/services/checkout'
import ArrowLeftSLineIcon from 'remixicon-react/ArrowLeftSLineIcon'
import ArrowRightSLineIcon from 'remixicon-react/ArrowRightSLineIcon'
import EditBoxLineIcon from 'remixicon-react/EditBoxLineIcon'
import { shippingSummary, type CartItem } from '../data/cart'
import {
  getMethodHint,
  mapCheckoutPaymentMethods,
  type CheckoutPaymentMethod,
} from '../data/checkoutPaymentMethods'
import { formatAmount, formatAmountDecimal, formatDeliveryDays } from '../data/format'
import type { OrderConflict } from '../data/orderConflicts'
import { useShop } from '../context/ShopContext'
import { useDefaultAddress } from '../hooks/useDefaultAddress'
import { OrderSummaryPanel } from './OrderSummaryPanel'
import { PageBreadcrumbs } from './PageBreadcrumbs'

/**
 * Formats a shipping quote for display.
 *
 * The deprecated `fee`/`deliveryWindow` strings are not used; the structured
 * `feeMoney` and `deliveryDays` are formatted here instead. A missing fee or day
 * range falls back to the static copy rather than rendering nothing, and a
 * `null` courier label falls back too, since the courier is optional.
 */
function mapShippingQuote(quote: ShippingQuote): typeof shippingSummary {
  const deliveryDays = formatDeliveryDays(quote.deliveryDays)

  return {
    fee: quote.feeMoney ? formatAmount(quote.feeMoney) : shippingSummary.fee,
    deliveryWindow: deliveryDays || shippingSummary.deliveryWindow,
    courierLabel: quote.courierLabel ?? shippingSummary.courierLabel,
  }
}

type CheckoutViewProps = {
  onGoHome: () => void
  onGoToCart: () => void
  onGoToProduct: (productId: string) => void
  onSubmitOrder: () => void
  /** "Change address": open the Addresses tab to pick a different one. */
  onGoToAddresses: () => void
  /** "Edit": open the Addresses tab with the default address's edit form open. */
  onEditDefaultAddress: () => void
  /** True while the payment intent is being created, before the redirect. */
  isSubmitting?: boolean
  /** Shown above the submit button when payment could not be started. */
  submitError?: string | null
  /**
   * Set when `POST /orders` rejected the attempt with a 409. The shopper has to
   * acknowledge it (typically a new price) before trying again, and acknowledging
   * is treated as a new decision rather than a retry.
   */
  orderConflict?: OrderConflict | null
  /** Clears the conflict and prepares a fresh attempt. */
  onAcknowledgeConflict?: () => void
  /**
   * Reports which method the shopper picked, by the backend's rid or code, so
   * `POST /checkout/payment-intent` can send it as `paymentMethodId`.
   */
  onPaymentMethodChange?: (paymentMethodId: string | null) => void
}

function PaymentRadio({
  selected,
  onSelect,
  label,
}: {
  selected: boolean
  onSelect: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={label}
      aria-pressed={selected}
      className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 ${
        selected ? 'border-text-primary bg-text-primary' : 'border-border-secondary bg-bg-primary'
      }`}
    >
      {selected ? <span className="size-3 rounded-full bg-bg-primary" aria-hidden /> : null}
    </button>
  )
}

/**
 * Item details card for a single cart line. The whole card is the link target so
 * the image and the text both open the product page.
 */
function CheckoutItemCard({ item, onSelect }: { item: CartItem; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`View ${item.name}`}
      className="flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border-primary bg-bg-primary text-left"
    >
      <span className="block w-full overflow-hidden bg-bg-secondary">
        <img alt="" className="aspect-square w-full object-cover" src={item.image} />
      </span>
      <span className="flex flex-col gap-1 p-3">
        <span className="line-clamp-2 text-sm leading-4.5 tracking-[-0.28px] text-text-primary">
          {item.name}
        </span>
        {item.variant ? (
          <span className="line-clamp-1 text-xs leading-4 tracking-[-0.24px] text-text-secondary">
            {item.variant}
          </span>
        ) : null}
        <span className="mt-1 flex items-center gap-1 text-text-primary">
          <span className="text-xs leading-4 tracking-[-0.24px]">{item.currency}</span>
          <span className="text-sm font-semibold leading-4.5 tracking-[-0.28px]">
            {formatAmountDecimal(item.price * item.quantity)}
          </span>
        </span>
      </span>
    </button>
  )
}

/**
 * Explains an order-time conflict so the shopper can act on it.
 *
 * `price_changed` lists the old and new price per affected line, because the
 * shopper has to agree to the new figure before the order can be placed. The
 * backend records that the conflict has now been shown, so resubmitting after
 * acknowledging is what accepts the new price.
 */
function OrderConflictNotice({
  conflict,
  onAcknowledge,
}: {
  conflict: OrderConflict
  onAcknowledge: () => void
}) {
  return (
    <div
      role="alert"
      className="mt-4 flex flex-col gap-3 rounded-xl bg-orange-light px-4 py-3"
    >
      <p className="text-sm font-medium leading-4.5 tracking-[-0.28px] text-primary-orange">
        {conflict.message}
      </p>

      {conflict.priceChanges.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {conflict.priceChanges.map((change) => (
            <li
              key={change.cartItemId}
              className="flex items-center justify-between gap-3 text-sm leading-4.5 tracking-[-0.28px] text-text-primary"
            >
              <span className="text-text-secondary line-through">
                {formatAmount(change.previousPrice)}
              </span>
              <span aria-hidden className="text-text-secondary">
                &rarr;
              </span>
              <span className="font-medium">{formatAmount(change.price)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {conflict.stockShortfalls.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {conflict.stockShortfalls.map((shortfall, index) => (
            <li
              key={`${shortfall.variantRid ?? 'variant'}-${index}`}
              className="text-sm leading-4.5 tracking-[-0.28px] text-text-primary"
            >
              Only {shortfall.available} left — you asked for {shortfall.requested}.
            </li>
          ))}
        </ul>
      ) : null}

      {conflict.unavailableCartItemIds.length > 0 ? (
        <p className="text-sm leading-4.5 tracking-[-0.28px] text-text-primary">
          Remove the unavailable items from your cart to continue.
        </p>
      ) : null}

      {conflict.isRetryable ? (
        <button
          type="button"
          onClick={onAcknowledge}
          className="cursor-pointer self-start rounded-full bg-bg-primary px-4 py-2 text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-primary"
        >
          {conflict.code === 'price_changed' ? 'Accept new prices' : 'Try again'}
        </button>
      ) : null}
    </div>
  )
}

export function CheckoutView({
  onGoHome,
  onGoToCart,
  onGoToProduct,
  onSubmitOrder,
  onGoToAddresses,
  onEditDefaultAddress,
  isSubmitting = false,
  submitError = null,
  orderConflict = null,
  onAcknowledgeConflict,
  onPaymentMethodChange,
}: CheckoutViewProps) {
  const { cartItems, cartItemCount } = useShop()
  // Selected lines are what the order summary bills, so item details mirrors them.
  const checkoutItems = useMemo(
    () => cartItems.filter((item) => item.selected),
    [cartItems],
  )
  // Methods come from the backend and are keyed by its rid/code; the first one
  // is preselected. A `null` id means nothing is chosen yet, which is also what
  // payment-intent receives.
  const [paymentMethods, setPaymentMethods] = useState<CheckoutPaymentMethod[]>([])
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null)
  const [previewShipping, setPreviewShipping] = useState(shippingSummary)
  // The address the on-screen figures were actually quoted for. Anything else
  // means the panel is stale, which is what `isQuotingShipping` reports.
  const [quotedAddressRid, setQuotedAddressRid] = useState<string | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  /**
   * The shipping address is the account's default address, read through the
   * same hook Your Profile uses, so the two always show the same record.
   */
  const { address: defaultAddress } = useDefaultAddress()
  // The quote is keyed by this rid, so a "Change address" that resolves to a
  // different record re-quotes instead of leaving the old fee on screen.
  const addressRid = defaultAddress?.rid
  // True while the panel is not showing figures for the current address. Derived
  // rather than set imperatively, so it also covers the gap before the re-quote
  // resolves without an extra render.
  const isQuotingShipping = addressRid !== undefined && quotedAddressRid !== addressRid

  const previewAddress = useMemo(
    () => ({
      contact: defaultAddress
        ? `${defaultAddress.contactName} | ${defaultAddress.phone}`.trim()
        : '',
      line1: defaultAddress?.line1 ?? '',
      line2: defaultAddress?.line2 ?? '',
    }),
    [defaultAddress],
  )

  useEffect(() => {
    let cancelled = false

    async function loadPreview() {
      try {
        const preview = await checkoutApi.getCheckoutPreview()
        if (cancelled) return

        const methods = mapCheckoutPaymentMethods(preview.paymentMethods)

        // Methods are admin-configured, so the backend is the source of truth. An
        // empty list is respected: the backend withheld every method for this
        // currency/destination, and inventing local defaults would offer a method
        // that cannot pay for the order.
        setPaymentMethods(methods)
        setPaymentMethodId((current) => {
          if (current && methods.some((method) => method.id === current)) return current

          const firstId = methods[0]?.id ?? null
          onPaymentMethodChange?.(firstId)
          return firstId
        })
        // The address comes from the account's default, not the preview copy,
        // which can be stale. This preview shipping is only a seed: the
        // destination-aware quote below supersedes it whenever there is a saved
        // address to quote for.
        if (preview.shipping) {
          setPreviewShipping({
            ...shippingSummary,
            ...mapShippingQuote(preview.shipping),
          })
        }
      } catch {
        // Keep static checkout copy when preview is unavailable.
      }
    }

    void loadPreview()

    return () => {
      cancelled = true
    }
  }, [onPaymentMethodChange])

  /**
   * Quotes shipping for the address actually being used.
   *
   * The preview above has no destination, so it prices the cart in the store
   * currency and can quote a fee for the wrong country. Quoting by the saved
   * address's rid gives the real fee, delivery days and courier for this
   * destination, and re-runs whenever the address changes.
   */
  useEffect(() => {
    // Without a saved address there is nothing to quote by; the preview stays.
    if (!addressRid) return

    const rid = addressRid
    let cancelled = false

    async function loadQuote() {
      try {
        const quote = await checkoutApi.getShippingQuote(rid)
        if (cancelled) return

        setPreviewShipping({
          ...shippingSummary,
          ...mapShippingQuote(quote),
        })
      } catch {
        // A failed quote keeps the preview's figures rather than blanking the
        // panel, so the shopper still sees a price.
      } finally {
        // Settled either way, so the panel is no longer marked as updating and
        // the stale figures are not advertised as this address's quote.
        if (!cancelled) setQuotedAddressRid(rid)
      }
    }

    void loadQuote()

    return () => {
      cancelled = true
    }
  }, [addressRid])

  // Selecting a method is the only place the choice is published.
  const handleSelectPaymentMethod = (id: string) => {
    setPaymentMethodId(id)
    onPaymentMethodChange?.(id)
  }

  const scrollCarousel = (direction: 'prev' | 'next') => {
    const track = trackRef.current
    if (!track) return
    track.scrollBy({ left: direction === 'next' ? 280 : -280, behavior: 'smooth' })
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
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-14">
          <div className="min-w-0 flex-1">
            <section className="border-b border-border-primary py-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold leading-6 tracking-[-0.4px] text-text-primary">
                  Shipping address
                </h2>
                <button
                  type="button"
                  onClick={onGoToAddresses}
                  className="flex cursor-pointer items-center gap-1 rounded-full bg-bg-secondary px-4 py-2 text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-primary"
                >
                  Change address
                  <ArrowRightSLineIcon className="size-6 text-text-secondary" aria-hidden />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="flex gap-4 rounded-xl bg-bg-secondary p-4">
                  {previewAddress.contact || previewAddress.line1 ? (
                    <div className="min-w-0 flex-1 text-sm leading-4.5 tracking-[-0.28px] text-text-primary">
                      <p className="font-medium">{previewAddress.contact}</p>
                      <div className="mt-2 flex flex-col gap-2 font-normal">
                        <p>{previewAddress.line1}</p>
                        <p>{previewAddress.line2}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="min-w-0 flex-1 text-sm leading-4.5 tracking-[-0.28px] text-text-primary">
                      <p className="font-medium">No default address saved</p>
                      <p className="mt-2 font-normal text-text-secondary">
                        Add one to know where this order ships.
                      </p>
                    </div>
                  )}
                  {/* The pencil edits the default address in place, so it opens the
                      Addresses tab with that address's form already up. */}
                  <button
                    type="button"
                    onClick={onEditDefaultAddress}
                    aria-label="Edit shipping address"
                    className="flex size-6 shrink-0 cursor-pointer items-center justify-center self-start"
                  >
                    <EditBoxLineIcon className="size-6 text-text-secondary" aria-hidden />
                  </button>
                </div>
                <div
                  className="rounded-xl bg-bg-secondary p-4 text-sm leading-4.5 tracking-[-0.28px] text-text-primary"
                  aria-busy={isQuotingShipping}
                >
                  <p className="font-medium">Shipping: {previewShipping.fee}</p>
                  <div className="mt-2 flex flex-col gap-2 font-normal">
                    <p>{previewShipping.deliveryWindow}</p>
                    <p>{previewShipping.courierLabel}</p>
                    {/* A re-quote keeps the previous figures on screen, so the
                        shopper is told they are mid-update rather than settled. */}
                    {isQuotingShipping ? (
                      <p aria-live="polite" className="text-text-secondary">
                        Updating for your address&hellip;
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <section className="border-b border-border-primary py-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold leading-6 tracking-[-0.4px] text-text-primary">
                  Item details({cartItemCount})
                </h2>
                <button
                  type="button"
                  onClick={onGoToCart}
                  className="flex cursor-pointer items-center gap-1 rounded-full bg-bg-secondary px-4 py-2 text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-primary"
                >
                  View all
                  <ArrowRightSLineIcon className="size-6 text-text-secondary" aria-hidden />
                </button>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => scrollCarousel('prev')}
                  aria-label="Previous items"
                  className="absolute left-0 top-1/2 z-10 hidden size-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-bg-primary shadow-[0px_1px_4px_0px_rgba(0,0,0,0.04),0px_4px_40px_0px_rgba(0,0,0,0.08)] lg:flex"
                >
                  <ArrowLeftSLineIcon className="size-6 text-text-secondary" aria-hidden />
                </button>
                <div
                  ref={trackRef}
                  className="flex gap-2 overflow-x-auto scroll-smooth [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden"
                >
                  {checkoutItems.map((item) => (
                    <div key={item.id} className="w-45 min-w-0 shrink-0 sm:w-56">
                      <CheckoutItemCard
                        item={item}
                        onSelect={() => {
                          const productId = item.productRid ?? item.id
                          if (productId) onGoToProduct(productId)
                        }}
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => scrollCarousel('next')}
                  aria-label="Next items"
                  className="absolute right-0 top-1/2 z-10 hidden size-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-bg-secondary shadow-[0px_1px_4px_0px_rgba(0,0,0,0.04),0px_4px_40px_0px_rgba(0,0,0,0.08)] lg:flex"
                >
                  <ArrowRightSLineIcon className="size-6 text-text-secondary" aria-hidden />
                </button>
              </div>
            </section>

            <section className="py-4">
              <h2 className="mb-4 text-xl font-semibold leading-6 tracking-[-0.4px] text-text-primary">
                Payment methods
              </h2>
              <div className="flex flex-col gap-6">
                {/* The backend withholds methods that cannot serve this order's
                    currency or destination, so an empty list is reported rather
                    than replaced with a local default that would fail on submit. */}
                {paymentMethods.length === 0 ? (
                  <p className="text-sm leading-4.5 tracking-[-0.28px] text-text-secondary">
                    No payment methods are available for your delivery destination. Please contact
                    us to complete your order.
                  </p>
                ) : null}
                {paymentMethods.map((method) => {
                  const isSelected = paymentMethodId === method.id

                  return (
                    <div key={method.id} className="flex flex-col gap-4">
                      <div className="flex items-center gap-4">
                        <PaymentRadio
                          selected={isSelected}
                          onSelect={() => handleSelectPaymentMethod(method.id)}
                          label={method.label}
                        />
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <span className="text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-primary">
                            {method.label}
                          </span>
                          {method.icon ? (
                            <img
                              alt=""
                              aria-hidden
                              className="h-8 w-10 object-contain"
                              src={method.icon}
                            />
                          ) : null}
                          {method.secondaryIcon ? (
                            <img
                              alt=""
                              aria-hidden
                              className="h-6 w-8 object-contain"
                              src={method.secondaryIcon}
                            />
                          ) : null}
                          {method.note ? (
                            <span className="text-sm leading-4.5 tracking-[-0.28px] text-text-secondary">
                              {method.note}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {isSelected ? (
                        <p className="text-sm leading-4.5 tracking-[-0.28px] text-text-secondary">
                          {getMethodHint(method)}
                        </p>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              {submitError ? (
                <p
                  role="alert"
                  className="mt-4 rounded-xl bg-orange-light px-4 py-3 text-sm font-medium leading-4.5 tracking-[-0.28px] text-primary-orange"
                >
                  {submitError}
                </p>
              ) : null}

              {orderConflict && onAcknowledgeConflict ? (
                <OrderConflictNotice
                  conflict={orderConflict}
                  onAcknowledge={onAcknowledgeConflict}
                />
              ) : null}

              <p className="mt-4 text-sm leading-4.5 tracking-[-0.28px] text-text-secondary">
                {isSubmitting
                  ? 'Placing your order and taking you to the secure payment page…'
                  : 'Submitting places your order, then redirects you to our payment provider to complete payment. Your card details are never entered on this site.'}
              </p>
            </section>

            <div className="mt-8 lg:hidden">
              <OrderSummaryPanel
                mode="checkout"
                onPrimaryAction={onSubmitOrder}
                isBusy={isSubmitting}
              />
            </div>
          </div>

          <div className="hidden lg:block">
            <OrderSummaryPanel
              mode="checkout"
              onPrimaryAction={onSubmitOrder}
              isBusy={isSubmitting}
            />
          </div>
        </div>
      </section>
    </>
  )
}
