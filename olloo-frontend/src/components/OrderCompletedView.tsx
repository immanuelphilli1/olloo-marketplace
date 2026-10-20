import { useEffect, useState } from 'react'
import CheckLineIcon from 'remixicon-react/CheckLineIcon'
import { ordersApi } from '../api'
import { mapApiOrderAddress, type OrderAddress } from '../api/mappers'
import type { ApiOrderDetail } from '../api/types'
import { orderCompletedCopy } from '../data/cart'
import { getProductPath } from '../data/shopRoutes'
import { useShop } from '../context/ShopContext'
import { useRecommendations } from '../hooks/useCatalogProducts'
import { PageBreadcrumbs } from './PageBreadcrumbs'
import { ProductCard } from './ProductCard'

type OrderCompletedViewProps = {
  onGoHome: () => void
}

/**
 * Confirmation page for a completed order.
 *
 * Everything shown here comes from the order the API recorded, not from the
 * account's current settings. That distinction matters: `POST /orders` freezes
 * the address and delivery window onto the order, so the shopper's default
 * address may since have been changed, and showing that instead would describe
 * an order that does not exist.
 *
 * `GET /orders/:rid` is therefore re-read on mount to get the shipping address,
 * which the placement response does not carry. Its `orderReference` and
 * `estimatedDelivery` are preferred over the carried copies when it arrives,
 * since they are read fresh from the order rather than across the redirect.
 */
export function OrderCompletedView({ onGoHome }: OrderCompletedViewProps) {
  const { lastOrder } = useShop()
  const recommendationProducts = useRecommendations('order-complete')

  // Populated from `GET /orders/:rid`. Null until it loads, and stays null if the
  // read fails, so the address block can report that rather than invent one.
  const [orderDetail, setOrderDetail] = useState<ApiOrderDetail | null>(null)
  // The rid whose read failed, rather than a plain flag: a new order starts with
  // no failure recorded, and the page never renders one order's error over
  // another's address without it being re-fetched first.
  const [failedOrderRid, setFailedOrderRid] = useState<string | null>(null)

  useEffect(() => {
    // Reached without a placed order (e.g. a stale /order-complete visit), so
    // there is nothing to re-read.
    const orderRid = lastOrder?.orderId
    if (!orderRid) return

    let cancelled = false

    async function loadOrder(orderRid: string) {
      try {
        const detail = await ordersApi.getOrder(orderRid)
        if (cancelled) return

        setOrderDetail(detail)
      } catch {
        // The reference and delivery wording below are already known, so a
        // failed re-read costs only the address block.
        if (!cancelled) setFailedOrderRid(orderRid)
      }
    }

    void loadOrder(orderRid)

    return () => {
      cancelled = true
    }
  }, [lastOrder?.orderId])

  const shippingAddress: OrderAddress | null = mapApiOrderAddress(orderDetail?.address)
  const didFailLoadingOrder = failedOrderRid !== null && failedOrderRid === lastOrder?.orderId

  // The placement response carries the frozen wording, so it is normally shown
  // straight away. The order detail is preferred when it arrives, since it is
  // read fresh from the order itself rather than carried across the redirect.
  const estimatedDelivery = orderDetail?.estimatedDelivery ?? lastOrder?.estimatedDelivery
  // Both are per-order facts; neither is rendered when the order is unknown.
  const orderReference = orderDetail?.orderReference ?? lastOrder?.orderReference

  return (
    <>
      <PageBreadcrumbs
        onGoBack={onGoHome}
        segments={[
          { label: 'Home', onClick: onGoHome },
          { label: 'Order Completed' },
        ]}
      />

      <section className="border-t border-border-primary px-4 pb-10 pt-6 lg:px-16 lg:pt-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-8">
          <div className="rounded-xl bg-bg-secondary p-4 text-center lg:p-6">
            <div className="mx-auto flex size-32 items-center justify-center rounded-full bg-primary-green p-2">
              <CheckLineIcon className="size-24 text-text-inverse" aria-hidden />
            </div>
            <h1 className="mt-4 text-3xl font-medium leading-10 tracking-[-0.64px] text-text-primary lg:text-5xl lg:leading-14 lg:tracking-[-0.96px]">
              {orderCompletedCopy.title}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-5 tracking-[-0.32px] text-text-secondary">
              {orderCompletedCopy.description}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/*
              The address is only rendered once the order has actually supplied
              one. A missing address is reported, never filled with a sample:
              telling a shopper an order went somewhere it did not go is worse
              than admitting the record is unavailable.
            */}
            {shippingAddress ? (
              <div className="rounded-xl bg-bg-secondary p-4">
                <p className="text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
                  Order will be shipped to:
                </p>
                {shippingAddress.contact ? (
                  <p className="mt-2 text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-primary">
                    {shippingAddress.contact}
                  </p>
                ) : null}
                {shippingAddress.line1 || shippingAddress.line2 ? (
                  <div className="mt-2 flex flex-col gap-2 text-sm leading-4.5 tracking-[-0.28px] text-text-primary">
                    {shippingAddress.line1 ? <p>{shippingAddress.line1}</p> : null}
                    {shippingAddress.line2 ? <p>{shippingAddress.line2}</p> : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl bg-bg-secondary p-4">
                <p className="text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
                  Shipping address
                </p>
                <p className="mt-2 text-sm leading-4.5 tracking-[-0.28px] text-text-secondary">
                  {didFailLoadingOrder
                    ? 'We could not load the address for this order. You can find it on the order in Your Orders.'
                    : 'The address for this order will appear here shortly.'}
                </p>
              </div>
            )}

            {/* Both figures come from the placed order. Nothing is shown when the
                order is unknown, since a reference or delivery date that was
                never issued would be worse than none. */}
            {orderReference ? (
              <div className="rounded-xl bg-bg-secondary p-4">
                <p className="text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
                  Your order Reference
                </p>
                <p className="mt-2 text-2xl lg:text-[32px] font-medium leading-10 tracking-[-0.64px] text-text-primary">
                  {orderReference}
                </p>
                {/*
                  `estimatedDelivery` is the wording the API froze onto the order
                  and it states it must be displayed as-is, so it is not
                  reformatted or rebuilt from a day range.
                */}
                {estimatedDelivery ? (
                  <p className="mt-2 text-sm leading-4.5 tracking-[-0.28px] text-text-primary">
                    {estimatedDelivery}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-10 lg:mt-14">
          <h2 className="mb-4 text-2xl font-medium leading-8 tracking-[-0.48px] text-text-primary lg:text-[32px] lg:leading-10 lg:tracking-[-0.64px]">
            You may also like
          </h2>
          <div className="grid grid-cols-2 items-stretch gap-2 lg:grid-cols-5 lg:gap-2">
            {recommendationProducts.slice(0, 10).map((product, index) => (
              <ProductCard
                key={`${product.id}-${index}`}
                product={product}
                // Without `to`, ProductCard renders a plain <article> rather than a
                // <Link>, so the recommendation looked live but did nothing when
                // tapped. `from` keeps the product page's breadcrumbs pointing back
                // here.
                to={getProductPath(product.id, { from: 'order-complete' })}
              />
            ))}
          </div>
        </div>
      </section>
    </>
  )
}