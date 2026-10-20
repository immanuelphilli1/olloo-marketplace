import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  mapApiOrder,
  mapApiPaymentMethods,
  mapApiProduct,
  mapApiProfile,
  mapApiReviewSlots,
  mapApiReviewedReviewSlots,
} from '../api/mappers'
import { accountApi, ordersApi } from '../api'
import type { LookupOption } from '../api'
import {
  notifyPreferredCountryChanged,
  writeStoredPreferredCountry,
} from '../api/preferredCountry'
import {
  coercePreferredCountryStoredValue,
  preferredCountryOptionValue,
  preferredCountryOptionValueForStored,
  preferredCountryPayloadForOption,
} from '../api/services/account'
import { ApiError } from '../api/client'
import { createStandalonePaymentIntentKey } from '../api/idempotency'
import { savePendingPayment } from '../api/pendingPayment'
import { useAuth } from '../context/AuthContext'
import ArrowDownSLineIcon from 'remixicon-react/ArrowDownSLineIcon'
import ArrowLeftSLineIcon from 'remixicon-react/ArrowLeftSLineIcon'
import ArrowRightSLineIcon from 'remixicon-react/ArrowRightSLineIcon'
import ChatHeartLineIcon from 'remixicon-react/ChatHeartLineIcon'
import FileList3LineIcon from 'remixicon-react/FileList3LineIcon'
import HistoryLineIcon from 'remixicon-react/HistoryLineIcon'
import Notification3LineIcon from 'remixicon-react/Notification3LineIcon'
import SearchLineIcon from 'remixicon-react/SearchLineIcon'
import UserLineIcon from 'remixicon-react/UserLineIcon'
import UserLocationLineIcon from 'remixicon-react/UserLocationLineIcon'
import Wallet3LineIcon from 'remixicon-react/Wallet3LineIcon'
import {
  getBuyAgainProductsFromOrders,
  getOrdersEmptyStateMessage,
  orderFilterTabs,
  type BuyAgainProduct,
  type OrderFilter,
  type OrderRecord,
  type OrderStatus,
} from '../data/orders'
import {
  filterReviews,
  getReviewsEmptyStateMessage,
  reviewFilterTabs,
  REVIEWED_REVIEWS_PAGE_SIZE,
  WAITING_REVIEWS_PAGE_SIZE,
  type ReviewFilter,
  type ReviewedReviewRecord,
  type WaitingReviewRecord,
} from '../data/reviews'
import {
  accountProtectionDescription,
  accountProtectionTitle,
  getProfileInitials,
  privacyNotice,
  profileTabs,
  type DefaultAddress,
  type ProfileTab,
  type SecuritySettings,
} from '../data/profile'
import {
  paymentTypeLabel,
  type PaymentMethodRecord,
  type PaymentMethodType,
} from '../data/paymentMethods'
import { getPaymentNetworkLabel } from '../data/paymentNetworks'
import { formatIsoDate } from '../data/format'
import { images } from '../assets/images'
import { AddReviewModal } from './AddReviewModal'
import { EditProfileModal } from './EditProfileModal'
import { BrowsingHistoryPanel } from './BrowsingHistoryPanel'
import { AddressesPanel } from './AddressesPanel'
import { PaymentMethodsPanel } from './PaymentMethodsPanel'
import { RatingStars } from './RatingStars'
import { NotificationsPanel } from './NotificationsPanel'
import { ListingLoader } from './ListingLoader'
import { AccountEmptyState } from './AccountEmptyState'
import { OrderTrackingModal } from './OrderTrackingModal'
import {
  SecurityActionModal,
  type SecurityAction,
  type SecurityActionValues,
} from './SecurityActionModal'
import { ReturnRefundModal } from './ReturnRefundModal'
import { useBuyAgain } from '../hooks/useBuyAgain'
import { useDefaultAddress } from '../hooks/useDefaultAddress'
import { usePaymentNetworks } from '../hooks/usePaymentNetworks'
import { useOrderDetail } from '../hooks/useOrderDetail'
import { useOrderReferences } from '../hooks/useOrderReferences'
import { useNavigate } from 'react-router-dom'
import { useShop } from '../context/ShopContext'
import { getCartPath, getHomePath } from '../data/shopRoutes'
import EditBoxLineIcon from 'remixicon-react/EditBoxLineIcon'
import LockFillIcon from 'remixicon-react/LockFillIcon'
import ShieldCheckFillIcon from 'remixicon-react/ShieldCheckFillIcon'

import {
  ADD_RESIDENCE_ADDRESS_PARAM,
  getAccountPath,
  type AccountSection,
} from '../data/accountRoutes'
import { writeResidenceAddressIntent } from '../api/residenceAddressIntent'
import {
  getAddressResidenceMismatch,
  type AddressResidenceMismatch,
} from '../utils/addressResidenceMatch'
import { CountryResidenceMismatchModal } from './CountryResidenceMismatchModal'

export type { AccountSection } from '../data/accountRoutes'

type YourOrdersViewProps = {
  onGoHome: () => void
  section: AccountSection
  onSectionChange: (section: AccountSection) => void
  /** Opens the refund policy page, used by the Return/Refund dialog. */
  onViewRefundPolicy: () => void
  /** Set when arriving at Addresses from checkout's "Edit" link. */
  startEditingDefaultAddress?: boolean
  /** Clears that intent once the form is dismissed. */
  onDismissEditIntent?: () => void
  startAddingResidenceAddress?: boolean
  onDismissResidenceAddIntent?: () => void
}

type RemixIcon = typeof UserLineIcon

type AccountNavItem = {
  id: string
  label: string
  icon: RemixIcon
}

const accountNavItems: AccountNavItem[] = [
  { id: 'orders', label: 'Your orders', icon: FileList3LineIcon },
  { id: 'reviews', label: 'Your reviews', icon: ChatHeartLineIcon },
  { id: 'profile', label: 'Your profile', icon: UserLineIcon },
  { id: 'history', label: 'Browsing history', icon: HistoryLineIcon },
  { id: 'addresses', label: 'Addresses', icon: UserLocationLineIcon },
  { id: 'payments', label: 'Saved cards', icon: Wallet3LineIcon },
  { id: 'notifications', label: 'Notifications', icon: Notification3LineIcon },
]

function statusBadgeClassName(status: OrderStatus): string {
  switch (status) {
    case 'delivered':
      return 'bg-primary-green'
    case 'processing':
      return 'bg-[#f0b100]'
    case 'shipped':
      return 'bg-primary-orange'
    case 'pending_payment':
      // Matches the yellow "processing" badge; the order is live but unpaid.
      return 'bg-[#f0b100]'
    case 'cancelled':
      return 'bg-text-secondary'
    default: {
      const exhaustiveCheck: never = status
      return exhaustiveCheck
    }
  }
}

function AccountBreadcrumbs({
  onGoHome,
  section,
}: {
  onGoHome: () => void
  section: AccountSection
}) {
  const label =
    section === 'reviews'
      ? 'Your Reviews'
      : section === 'profile'
        ? 'Your profile'
        : section === 'history'
          ? 'Browsing history'
          : section === 'addresses'
            ? 'Addresses'
            : section === 'payments'
              ? 'Payment methods'
              : section === 'notifications'
                ? 'Notification'
                : 'Your Orders'

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 px-4 py-2 lg:gap-1 lg:px-16">
      <button
        type="button"
        onClick={onGoHome}
        aria-label="Go back"
        className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-bg-secondary lg:hidden"
      >
        <ArrowLeftSLineIcon className="size-5 text-text-secondary" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onGoHome}
        className="cursor-pointer py-2.5 text-sm font-medium leading-4 tracking-[-0.28px] text-text-tertiary transition-colors hover:text-text-primary"
      >
        Home
      </button>
      <ArrowRightSLineIcon className="size-6 shrink-0 text-text-tertiary" aria-hidden />
      <span className="py-2.5 text-sm font-medium leading-4 tracking-[-0.28px] text-text-primary">
        {label}
      </span>
    </nav>
  )
}

function AccountSidebar({
  activeSection,
  onSectionChange,
}: {
  activeSection: AccountSection
  onSectionChange: (section: AccountSection) => void
}) {
  return (
    <aside className="hidden w-64 lg:w-52 xl:w-64 shrink-0 flex-col gap-2 lg:flex">
      {accountNavItems.map((item) => {
        const Icon = item.icon
        const isActive = item.id === activeSection
        const isNavigable =
          item.id === 'orders' ||
          item.id === 'reviews' ||
          item.id === 'profile' ||
          item.id === 'history' ||
          item.id === 'addresses' ||
          item.id === 'payments' ||
          item.id === 'notifications'

        return (
          <button
            key={item.id}
            type="button"
            onClick={isNavigable ? () => onSectionChange(item.id as AccountSection) : undefined}
            className={`flex w-full items-center gap-2 p-2 text-left ${
              isActive
                ? 'border-l-2 border-primary-orange bg-orange-light'
                : 'bg-bg-primary'
            } ${isNavigable ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <Icon
              className={`size-6 shrink-0 ${
                isActive ? 'text-primary-orange' : 'text-text-secondary'
              }`}
              aria-hidden
            />
            <span className="text-sm font-medium leading-4 tracking-[-0.28px] text-text-primary">
              {item.label}
            </span>
          </button>
        )
      })}
    </aside>
  )
}

function OrderProductCarousel({ images }: { images: string[] }) {
  const trackRef = useRef<HTMLDivElement>(null)

  const scrollByDirection = (direction: 'prev' | 'next') => {
    const track = trackRef.current
    if (!track) return
    const amount = direction === 'next' ? 134 : -134
    track.scrollBy({ left: amount, behavior: 'smooth' })
  }

  // Up to two products fit in the track without it scrolling, so the arrows
  // would move nothing. They are hidden rather than shown inert, since a control
  // that looks live but does nothing is worse than no control.
  const canScroll = images.length >= 3

  return (
    <div className="relative min-w-0 flex-1">
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto scroll-smooth [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden"
      >
        {images.map((image, index) => (
          <div
            key={`${image}-${index}`}
            className="size-29.5 shrink-0 overflow-hidden rounded-lg border border-border-primary bg-bg-secondary"
          >
            <img alt="" className="size-full object-cover" src={image} />
          </div>
        ))}
      </div>
      {canScroll ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between">
          <button
            type="button"
            onClick={() => scrollByDirection('prev')}
            className="pointer-events-auto flex size-12 cursor-pointer items-center justify-center rounded-full bg-bg-primary shadow-[0px_1px_4px_0px_rgba(0,0,0,0.04),0px_4px_40px_0px_rgba(0,0,0,0.08)]"
            aria-label="Previous products"
          >
            <ArrowLeftSLineIcon className="size-6 text-text-secondary" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => scrollByDirection('next')}
            className="pointer-events-auto flex size-12 cursor-pointer items-center justify-center rounded-full bg-bg-secondary shadow-[0px_1px_4px_0px_rgba(0,0,0,0.04),0px_4px_40px_0px_rgba(0,0,0,0.08)]"
            aria-label="Next products"
          >
            <ArrowRightSLineIcon className="size-6 text-text-secondary" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  )
}

function OrderCard({
  order,
  onBuyAgain,
  onReturnRefund,
  onTrackOrder,
  onViewDetails,
  onMakePayment,
  onCancelOrder,
  isBuyingAgain,
  isPayingOrderId,
  isCancellingOrderId,
  orderReference,
}: {
  order: OrderRecord
  onBuyAgain: (order: OrderRecord) => void
  onReturnRefund: (order: OrderRecord) => void
  onTrackOrder: (order: OrderRecord) => void
  onViewDetails: (order: OrderRecord) => void
  onMakePayment: (order: OrderRecord) => void
  onCancelOrder: (order: OrderRecord) => void
  isBuyingAgain: boolean
  isPayingOrderId: string | null
  /** Order currently being cancelled, so only its button shows progress. */
  isCancellingOrderId: string | null
  /**
   * Display reference, absent until its background read resolves or if it failed.
   * The row is omitted rather than shown blank, since the rid is already on the
   * line above it.
   */
  orderReference?: string
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border-primary">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-primary px-4 py-4 lg:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="text-sm leading-4 tracking-[-0.28px] text-text-secondary">
            {order.statusDateLabel}
          </p>
          <span
            className={`rounded px-1 py-0.5 text-xs font-medium leading-4 tracking-[-0.24px] text-text-inverse ${statusBadgeClassName(order.status)}`}
          >
            {order.statusBadgeLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onViewDetails(order)}
          className="group flex cursor-pointer items-center gap-0 text-sm font-medium leading-4 tracking-[-0.28px] text-text-primary"
        >
          View order details
          <ArrowRightSLineIcon
            className="size-6 text-text-secondary transition-colors group-hover:text-primary-orange"
            aria-hidden
          />
        </button>
      </div>

      {/*
        A single-image order is short enough that the image and the actions can
        share one row on mobile. With two or more the carousel needs the full
        width to scroll, so it keeps its own line. Desktop is always a row.
      */}
      <div
        className={`flex gap-4 px-4 py-4 lg:flex-row lg:items-start lg:gap-10 lg:px-6 ${
          order.productImages.length === 1 ? 'flex-row' : 'flex-col'
        }`}
      >
        <OrderProductCarousel images={order.productImages} />
        {/*
          `w-full` only while stacked: in the single-image row it would claim the
          whole width and squeeze the image out, so the column sizes to the
          buttons instead.
        */}
        <div
          className={`flex shrink-0 gap-2 lg:w-65.5 lg:flex-col ${
            order.productImages.length === 1 ? 'w-auto flex-col' : 'w-full'
          }`}
        >
          <button
            type="button"
            onClick={() => onBuyAgain(order)}
            disabled={isBuyingAgain}
            className="flex h-8.5 cursor-pointer items-center justify-center rounded-full bg-orange-light px-4 text-sm font-medium leading-4 tracking-[-0.28px] text-primary-orange disabled:cursor-wait disabled:opacity-60"
          >
            {isBuyingAgain ? 'Adding…' : 'Buy Again'}
          </button>
          {/*
            An unpaid order has nothing to return, track or refund yet, so that
            slot becomes Cancel order — the action that actually applies to an
            order that was never paid. The payment button is filled to read as
            the primary action on the card.
          */}
          {order.status === 'pending_payment' ? (
            <>
              <button
                type="button"
                onClick={() => onCancelOrder(order)}
                disabled={isCancellingOrderId === order.id}
                className="flex h-8.5 cursor-pointer items-center justify-center rounded-full bg-bg-secondary px-4 text-sm font-medium leading-4 tracking-[-0.28px] text-text-primary disabled:cursor-wait disabled:opacity-60"
              >
                {isCancellingOrderId === order.id ? 'Cancelling…' : 'Cancel order'}
              </button>
              <button
                type="button"
                onClick={() => onMakePayment(order)}
                disabled={isPayingOrderId === order.id}
                className="flex h-8.5 cursor-pointer items-center justify-center rounded-full bg-primary-orange px-4 text-sm font-medium leading-4 tracking-[-0.28px] text-text-inverse disabled:cursor-wait disabled:opacity-60"
              >
                {isPayingOrderId === order.id ? 'Opening…' : 'Make payment'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onReturnRefund(order)}
                className="flex h-8.5 cursor-pointer items-center justify-center rounded-full bg-bg-secondary px-4 text-sm font-medium leading-4 tracking-[-0.28px] text-text-primary"
              >
                Return/Refund
              </button>
              <button
                type="button"
                onClick={() => onTrackOrder(order)}
                className="flex h-8.5 cursor-pointer items-center justify-center rounded-full bg-bg-secondary px-4 text-sm font-medium leading-4 tracking-[-0.28px] text-text-primary"
              >
                Track order
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border-primary px-4 py-4 text-sm leading-4 tracking-[-0.28px] text-text-secondary lg:flex-row lg:flex-wrap lg:gap-6 lg:px-6">
        <p>
          {order.itemCount} items:{' '}
          <span className="font-medium text-text-primary">{order.total}</span>
        </p>
        <p>
          Order Time:{' '}
          <span className="font-medium text-text-primary">{order.orderTime}</span>
        </p>
        <p>
          Order ID: <span className="font-medium text-text-primary">{order.id}</span>
        </p>
        {/* The list endpoint does not return the reference, so it arrives from a
            background read and the row is omitted until it does. */}
        {orderReference ? <p>Order Reference: {orderReference}</p> : null}
      </div>
    </article>
  )
}

function OrdersPanel({
  onViewRefundPolicy,
  onOrdersChange,
  onLoadingChange,
}: {
  onViewRefundPolicy: () => void
  onOrdersChange: (orders: OrderRecord[]) => void
  onLoadingChange: (isLoading: boolean) => void
}) {
  const [activeFilter, setActiveFilter] = useState<OrderFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()
  const { applyCartResponse: applyCart } = useShop()
  const [trackingOrder, setTrackingOrder] = useState<OrderRecord | null>(null)
  const [returnOrderTarget, setReturnOrderTarget] = useState<OrderRecord | null>(null)
  /** Order the loaded `returnEligibility` belongs to. */
  const [returnEligibilityOrderId, setReturnEligibilityOrderId] = useState<string | null>(null)
  const [isBuyingAgain, setIsBuyingAgain] = useState(false)
  /** Order currently opening its payment provider page, if any. */
  const [isPayingOrderId, setIsPayingOrderId] = useState<string | null>(null)
  /** Order currently being cancelled, so only its button shows progress. */
  const [isCancellingOrderId, setIsCancellingOrderId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [residenceMismatch, setResidenceMismatch] = useState<AddressResidenceMismatch | null>(
    null,
  )
  const [pendingPaymentOrder, setPendingPaymentOrder] = useState<OrderRecord | null>(null)
  const { authUser } = useAuth()
  const { address: defaultAddress } = useDefaultAddress()
  const { buyOrderAgain, addBuyAgainProductToCart } = useBuyAgain()
  const {
    lines,
    events,
    returnEligibility,
    isLoading: isDetailLoading,
    loadOrderDetail,
    reset,
  } = useOrderDetail()

  /**
   * Loads the list for the active filter and search.
   *
   * Shared with the cancel action, which must re-read the list so the card shows
   * the status the backend recorded rather than a locally patched one.
   */
  const loadOrdersForPanel = useCallback(async () => {
    try {
      const response = await ordersApi.listOrders({
        status: activeFilter === 'all' ? undefined : activeFilter,
        search: searchQuery.trim() || undefined,
      })
      setOrders(response.orders.map(mapApiOrder))
    } catch {
      setOrders([])
    }
  }, [activeFilter, searchQuery])

  useEffect(() => {
    let cancelled = false

    async function loadOrders() {
      setIsLoading(true)
      try {
        const response = await ordersApi.listOrders({
          status: activeFilter === 'all' ? undefined : activeFilter,
          search: searchQuery.trim() || undefined,
        })
        if (!cancelled) {
          setOrders(response.orders.map(mapApiOrder))
        }
      } catch {
        if (!cancelled) {
          setOrders([])
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadOrders()

    return () => {
      cancelled = true
    }
  }, [activeFilter, searchQuery])

  useEffect(() => {
    onLoadingChange(isLoading)
  }, [isLoading, onLoadingChange])

  // The "Buy this again" rail is a sibling of this panel, so the loaded orders
  // are published upward to keep both in step.
  useEffect(() => {
    onOrdersChange(orders)
  }, [onOrdersChange, orders])

  // Hooks run before any early return, so the reference read is started for every
  // loaded order rather than for the already-filtered set. Filtering on a value
  // that hook produces would otherwise be circular.
  const { references } = useOrderReferences(orders.map((order) => order.id))

  const filteredOrders = orders.filter((order) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.trim().toLowerCase()
    // The server already filters on rid *or* reference, so a result can match
    // only on the reference. Matching the rid alone here would then discard the
    // very rows the shopper searched for.
    return (
      order.id.toLowerCase().includes(query) ||
      references[order.id]?.toLowerCase().includes(query) === true
    )
  })

  const emptyStateMessage = getOrdersEmptyStateMessage(activeFilter, searchQuery.trim().length > 0)

  /**
   * Buy Again asks the server to re-add the order's own lines, then refreshes the
   * cart. Falls back to adding the lines client-side if the call fails, so the
   * button always does something useful.
   */
  const handleBuyAgain = async (order: OrderRecord) => {
    setIsBuyingAgain(true)
    setNotice(null)

    try {
      const cart = await ordersApi.buyAgainOrder(order.id)
      applyCart(cart)
      navigate(getCartPath())
    } catch {
      const orderWithLines = lines.length > 0 ? { ...order, lines } : order
      if (orderWithLines.lines && orderWithLines.lines.length > 0) {
        await buyOrderAgain(orderWithLines.lines)
        return
      }
      setNotice('We could not add this order to your cart. Please try again.')
    } finally {
      setIsBuyingAgain(false)
    }
  }

  /** Posts the return request; the modal owns the success and error states. */
  const handleReturnRequest = async (orderId: string, reason: string) => {
    await ordersApi.returnOrder(orderId, reason)
  }

  /**
   * Reopens payment for an order still awaiting it, then hands off to the
   * provider. The order already exists, so unlike checkout there is no
   * `POST /orders` step here — only `payment-intent` against the same order id.
   */
  const proceedMakePayment = async (order: OrderRecord) => {
    setNotice(null)
    setIsPayingOrderId(order.id)

    try {
      const intent = await ordersApi.createOrderPaymentIntent(
        order.id,
        // A fresh key per click: this request carries a different body from the
        // checkout attempt that created the order, so it must not share its key.
        createStandalonePaymentIntentKey(),
      )

      // The reference and the frozen delivery wording are read from the order
      // itself. `order.statusDateLabel` is the date the order's *status* last
      // changed, which is not a delivery estimate — the return page would have
      // shown it as one. The order detail is the only source for both.
      const detail = await ordersApi.getOrder(order.id)

      savePendingPayment({
        paymentRid: intent.paymentRid,
        provider: intent.provider,
        orderId: intent.orderId,
        orderReference: detail.orderReference ?? intent.orderId,
        estimatedDelivery: detail.estimatedDelivery ?? null,
      })

      // Full-page navigation is required: the provider page is external and
      // React Router cannot own it.
      window.location.href = intent.checkoutUrl
    } catch (error) {
      setIsPayingOrderId(null)
      setNotice(
        error instanceof ApiError && error.message
          ? error.message
          : 'We could not open payment for this order. Please try again.',
      )
    }
  }

  const handleMakePayment = async (order: OrderRecord) => {
    setNotice(null)

    try {
      const mismatch = await getAddressResidenceMismatch(defaultAddress, authUser?.email)
      if (mismatch) {
        setPendingPaymentOrder(order)
        setResidenceMismatch(mismatch)
        return
      }
    } catch {
      // If the check fails, still attempt payment rather than blocking silently.
    }

    await proceedMakePayment(order)
  }

  const handleProceedAnywayFromOrders = () => {
    const order = pendingPaymentOrder
    setResidenceMismatch(null)
    setPendingPaymentOrder(null)
    if (order) {
      void proceedMakePayment(order)
    }
  }

  const handleAddAddressForResidenceFromOrders = () => {
    if (!residenceMismatch) return

    writeResidenceAddressIntent(residenceMismatch.residenceCountryCode)
    setResidenceMismatch(null)
    navigate(`${getAccountPath('addresses')}${ADD_RESIDENCE_ADDRESS_PARAM}`)
  }

  /**
   * Cancels an order that is still awaiting payment.
   *
   * Confirmed first, since this is destructive and immediate: the order is
   * released and cannot be paid afterwards. The list is reloaded from the server
   * rather than patched locally, so the card shows the status the backend
   * actually recorded.
   */
  const handleCancelOrder = async (order: OrderRecord) => {
    setNotice(null)

    if (!window.confirm('Cancel this order? It cannot be paid afterwards.')) {
      return
    }

    setIsCancellingOrderId(order.id)

    try {
      await ordersApi.cancelOrder(order.id)
      await loadOrdersForPanel()
    } catch (error) {
      setNotice(
        error instanceof ApiError && error.message
          ? error.message
          : 'We could not cancel this order. Please try again.',
      )
    } finally {
      setIsCancellingOrderId(null)
    }
  }

  const openTracking = (order: OrderRecord) => {
    setTrackingOrder(order)
    void loadOrderDetail(order)
  }

  const closeTracking = () => {
    setTrackingOrder(null)
    reset()
  }

  const trackingOrderWithLines: OrderRecord | null = trackingOrder
    ? { ...trackingOrder, lines: lines.length > 0 ? lines : trackingOrder.lines }
    : null

  return (
    <>
      <OrderTrackingModal
        order={trackingOrderWithLines}
        events={events}
        isLoading={isDetailLoading}
        onClose={closeTracking}
      />
      <ReturnRefundModal
        order={returnOrderTarget}
        onClose={() => {
          setReturnOrderTarget(null)
          setReturnEligibilityOrderId(null)
          reset()
        }}
        onViewPolicy={onViewRefundPolicy}
        onSubmit={handleReturnRequest}
        returnEligibility={
          returnEligibilityOrderId === returnOrderTarget?.id ? returnEligibility : null
        }
      />
      <CountryResidenceMismatchModal
        isOpen={residenceMismatch !== null}
        mismatch={residenceMismatch}
        onClose={() => {
          setResidenceMismatch(null)
          setPendingPaymentOrder(null)
        }}
        onAddAddressForResidence={handleAddAddressForResidenceFromOrders}
        onProceedAnyway={handleProceedAnywayFromOrders}
      />
      {notice ? (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-orange-light px-4 py-3 text-sm font-medium leading-4.5 tracking-[-0.28px] text-primary-orange"
        >
          {notice}
        </p>
      ) : null}
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-6 overflow-x-auto border-b border-border-primary pb-3 [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden">
          {orderFilterTabs.map((tab) => {
            const isActive = tab.id === activeFilter

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`relative shrink-0 cursor-pointer pb-3.5 text-sm font-medium leading-4 tracking-[-0.28px] ${
                  isActive ? 'text-text-primary' : 'text-text-tertiary'
                }`}
              >
                {tab.label}
                {isActive ? (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary-orange" aria-hidden />
                ) : null}
              </button>
            )
          })}
        </div>

        <label className="flex h-11 shrink-0 items-center rounded-full border border-border-secondary p-1 lg:w-78.5">
          <span className="flex min-w-0 flex-1 px-4">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Item name / Order / Tracking No."
              className="w-full bg-transparent text-xs leading-4 tracking-[-0.24px] text-text-primary outline-none placeholder:text-[#a1a3a3]"
            />
          </span>
          <span className="flex size-9 items-center justify-center p-2">
            <SearchLineIcon className="size-5 text-text-secondary" aria-hidden />
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-4">
        {isLoading ? (
          <ListingLoader label="Loading orders" />
        ) : filteredOrders.length > 0 ? (
          filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onBuyAgain={handleBuyAgain}
              isBuyingAgain={isBuyingAgain}
              onReturnRefund={(order) => {
                // Eligibility only exists on the detail payload, so it is fetched
                // before the dialog opens. The order id is remembered so a
                // previous order's eligibility is never shown for this one.
                setReturnOrderTarget(order)
                setReturnEligibilityOrderId(order.id)
                void loadOrderDetail(order)
              }}
              onTrackOrder={openTracking}
              onViewDetails={openTracking}
              onMakePayment={(order) => {
                void handleMakePayment(order)
              }}
              onCancelOrder={(order) => {
                void handleCancelOrder(order)
              }}
              isPayingOrderId={isPayingOrderId}
              isCancellingOrderId={isCancellingOrderId}
              orderReference={references[order.id]}
            />
          ))
        ) : (
          <AccountEmptyState message={emptyStateMessage} />
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 xl:hidden">
        <p className="col-span-2 text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
          Buy this again
        </p>
        {/* Same rule as the desktop rail: only products from real orders, with
            no static fallback that would imply a purchase that never happened. */}
        {isLoading ? (
          <div className="col-span-2">
            <ListingLoader label="Loading buy again" />
          </div>
        ) : getBuyAgainProductsFromOrders(orders).length > 0 ? (
          getBuyAgainProductsFromOrders(orders)
            .slice(0, 4)
            .map((product) => (
              <div
                key={`mobile-${product.id}`}
                className="overflow-hidden rounded-2xl border border-border-primary p-2"
              >
                <BuyAgainProductCard
                  product={product}
                  onAddToCart={(productId) => {
                    void addBuyAgainProductToCart(productId)
                  }}
                />
              </div>
            ))
        ) : (
          <p className="col-span-2 text-sm leading-4.5 tracking-[-0.28px] text-text-secondary">
            Nothing to buy again yet. Products you order will appear here.
          </p>
        )}
      </div>
    </>
  )
}

function ReviewProductDetails({
  review,
}: {
  review: WaitingReviewRecord | ReviewedReviewRecord
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-col gap-2 lg:gap-4">
        <p className="line-clamp-2 text-sm leading-4.5 tracking-[-0.28px] text-text-secondary">
          {review.productName}
        </p>

        <div className="flex flex-col items-start gap-1 lg:flex-row lg:flex-wrap lg:items-center lg:gap-4">
          <span className="rounded-lg bg-bg-secondary px-2 py-1 text-xs font-medium leading-4 tracking-[-0.24px] text-text-primary">
            Order ID: {review.orderId}
          </span>
          <span aria-hidden className="hidden h-4 w-px bg-border-secondary lg:block" />
          <span className="px-2 py-1 text-xs font-medium leading-4 tracking-[-0.24px] text-text-tertiary lg:px-0 lg:py-0">
            Delivered on {review.deliveredOn}
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-4 lg:mt-4 lg:gap-8">
        <p className="flex items-baseline gap-1 text-text-primary">
          <span className="text-sm leading-4.5 tracking-[-0.28px]">{review.priceCurrency}</span>
          <span className="text-base font-semibold leading-5 tracking-[-0.32px] lg:text-xl lg:leading-6 lg:tracking-[-0.4px]">
            {review.priceAmount}
          </span>
        </p>
        <p className="text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-tertiary">
          QTY: {review.quantity}
        </p>
      </div>
    </div>
  )
}

function ReviewRowActions({
  primaryAction,
  onViewDetails,
}: {
  primaryAction: ReactNode
  onViewDetails: () => void
}) {
  return (
    <div className="flex w-full items-center gap-4 lg:w-54 lg:flex-col lg:items-center lg:gap-4">
      {primaryAction}
      <button
        type="button"
        onClick={onViewDetails}
        className="group flex shrink-0 cursor-pointer items-center gap-0 text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-primary lg:justify-center"
      >
        View order details
        <ArrowRightSLineIcon
          className="size-6 text-text-secondary transition-colors group-hover:text-primary-orange"
          aria-hidden
        />
      </button>
    </div>
  )
}

function WaitingReviewRow({
  review,
  onAddReview,
  onViewDetails,
}: {
  review: WaitingReviewRecord
  onAddReview: (review: WaitingReviewRecord) => void
  onViewDetails: () => void
}) {
  return (
    <article className="flex flex-col gap-6 border-b border-border-primary py-4 lg:flex-row lg:items-center lg:gap-6">
      <div className="flex w-full gap-3 lg:contents">
        <div className="size-31 shrink-0 overflow-hidden rounded-lg border border-border-primary bg-bg-secondary lg:size-29.5">
          <img alt="" className="size-full object-cover" src={review.productImage} />
        </div>

        <ReviewProductDetails review={review} />
      </div>

      <ReviewRowActions
        primaryAction={
          <button
            type="button"
            onClick={() => onAddReview(review)}
            className="flex h-8.5 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-full border border-primary-orange px-4 text-sm font-medium leading-4.5 tracking-[-0.28px] text-primary-orange lg:w-full lg:flex-none"
          >
            Add review
          </button>
        }
        onViewDetails={onViewDetails}
      />
    </article>
  )
}

/**
 * A submitted review is not published until staff approve it, so the row says
 * which state it is in and shows what the shopper actually wrote rather than an
 * empty shell.
 */
function ReviewStatusBadge({ status }: { status: ReviewedReviewRecord['status'] }) {
  const isPublished = status === 'published'

  return (
    <span
      className={`rounded-lg px-2 py-1 text-xs font-medium leading-4 tracking-[-0.24px] ${
        isPublished ? 'bg-green-light text-primary-green' : 'bg-bg-secondary text-text-secondary'
      }`}
    >
      {isPublished ? 'Published' : 'Awaiting approval'}
    </span>
  )
}

function ReviewedReviewContent({ review }: { review: ReviewedReviewRecord }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-col gap-2 lg:gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <ReviewStatusBadge status={review.status} />
          {review.submittedOn ? (
            <span className="text-xs font-medium leading-4 tracking-[-0.24px] text-text-tertiary">
              Reviewed on {review.submittedOn}
            </span>
          ) : null}
        </div>

        {review.title ? (
          <p className="text-sm font-semibold leading-4.5 tracking-[-0.28px] text-text-primary">
            {review.title}
          </p>
        ) : null}

        {review.text ? (
          <p className="line-clamp-2 text-sm leading-4.5 tracking-[-0.28px] text-text-secondary">
            {review.text}
          </p>
        ) : null}
      </div>

      {review.rating !== null ? (
        <div className="mt-2 flex items-center gap-1 lg:mt-4">
          <RatingStars value={review.rating} />
        </div>
      ) : null}
    </div>
  )
}

function ReviewedReviewRow({
  review,
  onViewDetails,
}: {
  review: ReviewedReviewRecord
  onViewDetails: () => void
}) {
  return (
    <article className="flex flex-col gap-6 border-b border-border-primary py-4 lg:flex-row lg:items-center lg:gap-6">
      <div className="flex w-full gap-3 lg:contents">
        <div className="size-31 shrink-0 overflow-hidden rounded-lg border border-border-primary bg-bg-secondary lg:size-29.5">
          <img alt="" className="size-full object-cover" src={review.productImage} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm leading-4.5 tracking-[-0.28px] text-text-secondary">
            {review.productName}
          </p>
          <ReviewedReviewContent review={review} />
        </div>
      </div>

      <ReviewRowActions
        primaryAction={
          <button
            type="button"
            className="btn-orange flex h-8.5 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-full px-4 text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-inverse lg:h-9 lg:w-full lg:flex-none lg:text-base lg:leading-5 lg:tracking-[-0.32px]"
          >
            Buy Again
          </button>
        }
        onViewDetails={onViewDetails}
      />
    </article>
  )
}

function ReviewsPanel() {
  const [activeFilter, setActiveFilter] = useState<ReviewFilter>('waiting')
  const [visibleCount, setVisibleCount] = useState(WAITING_REVIEWS_PAGE_SIZE)
  const [reviewModalTarget, setReviewModalTarget] = useState<WaitingReviewRecord | null>(null)
  const [waitingItems, setWaitingItems] = useState<WaitingReviewRecord[]>([])
  const [reviewedItems, setReviewedItems] = useState<ReviewedReviewRecord[]>([])
  const [isLoadingReviews, setIsLoadingReviews] = useState(true)

  // Both review lists are loaded up front so switching tabs is instant.
  useEffect(() => {
    let cancelled = false

    async function loadReviews() {
      setIsLoadingReviews(true)
      try {
        const [waiting, reviewed] = await Promise.all([
          accountApi.getWaitingReviews(),
          accountApi.getReviewedReviews(),
        ])
        if (cancelled) return

        // Set unconditionally, including for empty results, so an account with
        // nothing to review is not masked by the removed seed rows.
        setWaitingItems(mapApiReviewSlots(waiting))
        setReviewedItems(mapApiReviewedReviewSlots(reviewed))
      } catch {
        // Keep whatever is on screen; a load failure should not blank the tabs.
      } finally {
        if (!cancelled) setIsLoadingReviews(false)
      }
    }

    void loadReviews()

    return () => {
      cancelled = true
    }
  }, [])

  const pageSize =
    activeFilter === 'waiting' ? WAITING_REVIEWS_PAGE_SIZE : REVIEWED_REVIEWS_PAGE_SIZE
  const filteredReviews = filterReviews(activeFilter, waitingItems, reviewedItems)
  const hasMore = visibleCount < filteredReviews.length
  const emptyStateMessage = getReviewsEmptyStateMessage()

  const handleFilterChange = (filter: ReviewFilter) => {
    setActiveFilter(filter)
    setVisibleCount(filter === 'waiting' ? WAITING_REVIEWS_PAGE_SIZE : REVIEWED_REVIEWS_PAGE_SIZE)
  }

  /**
   * "View order details" opens the same tracker the orders tab uses. A review row
   * carries only an order reference, so the detail is fetched for that id and the
   * modal takes its title and image from the real line once it arrives.
   */
  const { lines, events, isLoading: isDetailLoading, loadOrderDetail, reset } = useOrderDetail()
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  const [detailOrderIdLoading, setDetailOrderIdLoading] = useState(false)

  const openOrderDetails = async (review: WaitingReviewRecord | ReviewedReviewRecord) => {
    const orderId = review.orderId
    if (!orderId) return

    const detailOrder: OrderRecord = {
      id: orderId,
      status: 'delivered',
      statusDateLabel: '',
      statusBadgeLabel: '',
      itemCount: 1,
      total: `${review.priceCurrency} ${review.priceAmount}`.trim(),
      orderTime: review.deliveredOn,
      productImages: review.productImage ? [review.productImage] : [],
    }

    setDetailOrderId(orderId)
    setDetailOrderIdLoading(true)
    try {
      await loadOrderDetail(detailOrder)
    } finally {
      setDetailOrderIdLoading(false)
    }
  }

  const closeTracking = () => {
    setDetailOrderId(null)
    reset()
  }

  const trackingOrder: OrderRecord | null = detailOrderId
    ? {
        id: detailOrderId,
        status: 'delivered',
        statusDateLabel: '',
        statusBadgeLabel: '',
        itemCount: lines.length,
        total: '',
        orderTime: '',
        productImages: lines.map((line) => line.image),
        lines: lines.length > 0 ? lines : undefined,
      }
    : null

  return (
    <>
      {/* Keyed by review id so a new target always starts from a blank form. */}
      <AddReviewModal
        key={reviewModalTarget?.id ?? 'closed'}
        review={reviewModalTarget}
        onClose={() => setReviewModalTarget(null)}
        onSubmitSuccess={(submitted) => {
          // The row moves out of waiting and into reviewed using the values the
          // server accepted. The next load replaces this with the real
          // `createdAt` and `status`, so it is a preview rather than a guess.
          const waiting = waitingItems.find((item) => item.id === submitted.reviewId)
          if (!waiting) return

          const reviewed: ReviewedReviewRecord = {
            ...waiting,
            submittedOn: formatIsoDate(new Date().toISOString()),
            status: submitted.status,
            rating: submitted.rating,
            title: submitted.title,
            text: submitted.detailedReview,
          }

          setWaitingItems((items) => items.filter((item) => item.id !== submitted.reviewId))
          setReviewedItems((items) => [reviewed, ...items])
        }}
      />

      <OrderTrackingModal
        order={trackingOrder}
        events={events}
        isLoading={isDetailLoading || detailOrderIdLoading}
        onClose={closeTracking}
      />

      <div className="mb-4 flex gap-6 overflow-x-auto border-b border-border-primary px-4 pb-3 [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden">
        {reviewFilterTabs.map((tab) => {
          const isActive = tab.id === activeFilter

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleFilterChange(tab.id)}
              className={`relative shrink-0 cursor-pointer pb-3.5 text-sm font-medium leading-4 tracking-[-0.28px] ${
                isActive ? 'text-text-primary' : 'text-text-tertiary'
              }`}
            >
              {tab.label}
              {isActive ? (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary-orange" aria-hidden />
              ) : null}
            </button>
          )
        })}
      </div>

      {isLoadingReviews ? (
        <ListingLoader label="Loading reviews" />
      ) : filteredReviews.length > 0 ? (
        <div className="px-4">
          <div className="flex flex-col">
            {/* Each branch reads its own array: the two record types differ, so a
                single mapped union would narrow to the waiting shape and lose
                the review content on the reviewed row. */}
            {activeFilter === 'waiting'
              ? waitingItems.slice(0, visibleCount).map((review) => (
                  <WaitingReviewRow
                    key={review.id}
                    review={review}
                    onAddReview={setReviewModalTarget}
                    onViewDetails={() => void openOrderDetails(review)}
                  />
                ))
              : reviewedItems.slice(0, visibleCount).map((review) => (
                  <ReviewedReviewRow
                    key={review.id}
                    review={review}
                    onViewDetails={() => void openOrderDetails(review)}
                  />
                ))}
          </div>

          {hasMore ? (
            <div className="flex justify-center py-6">
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((count) =>
                    Math.min(count + pageSize, filteredReviews.length),
                  )
                }
                className="flex cursor-pointer items-center gap-2 rounded-full border border-border-secondary px-4 py-2 text-base font-medium leading-5 tracking-[-0.32px] text-text-primary"
              >
                View more
                <ArrowDownSLineIcon className="size-6 text-text-secondary" aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <AccountEmptyState message={emptyStateMessage} />
      )}
    </>
  )
}

function BuyAgainProductCard({
  product,
  onAddToCart,
}: {
  product: BuyAgainProduct
  onAddToCart: (productId: string) => void
}) {
  return (
    <div className="overflow-hidden rounded-lg bg-bg-primary">
      <div className="overflow-hidden rounded-lg bg-bg-secondary">
        <img alt={product.name} className="aspect-square w-full object-cover" src={product.image} />
      </div>
      <div className="px-1 py-2">
        <p className="truncate text-xs font-medium leading-4 tracking-[-0.24px] text-text-primary">
          {product.name}
        </p>
        <p className="mt-2 text-sm font-medium leading-4 tracking-[-0.28px] text-text-primary">
          {product.price}
        </p>
        <button
          type="button"
          onClick={() => onAddToCart(product.id)}
          className="btn-orange mt-2 flex h-8.5 w-full cursor-pointer items-center justify-center rounded-full px-4 text-sm font-medium leading-4 tracking-[-0.28px] text-text-inverse"
        >
          Add to cart
        </button>
      </div>
    </div>
  )
}

function ProfileTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: ProfileTab
  onTabChange: (tab: ProfileTab) => void
}) {
  return (
    <div className="mb-0 flex gap-6 overflow-x-auto border-b border-border-primary px-4 pb-3 [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden lg:px-4">
      {profileTabs.map((tab) => {
        const isActive = tab.id === activeTab

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`relative shrink-0 cursor-pointer pb-3.5 text-sm font-medium leading-4.5 tracking-[-0.28px] ${
              isActive ? 'text-text-primary' : 'text-text-tertiary'
            }`}
          >
            {tab.label}
            {isActive ? (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary-orange" aria-hidden />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function ProfileAvatar({ initials }: { initials: string }) {
  return (
    <div className="flex size-18 shrink-0 items-center justify-center rounded-full bg-bg-secondary text-[32px] font-medium leading-10 tracking-[-0.64px] text-text-primary">
      {initials}
    </div>
  )
}

function PrivacyNotice() {
  return (
    <div className="flex items-start gap-1 px-4 py-4 lg:px-6">
      <LockFillIcon className="size-6 shrink-0 text-primary-green" aria-hidden />
      <p className="text-sm leading-4.5 tracking-[-0.28px] text-primary-green">{privacyNotice}</p>
    </div>
  )
}

function CountryResidenceSelect({
  countries,
  preferredCountry,
  isSaving,
  onChange,
}: {
  countries: LookupOption[]
  preferredCountry: string | null
  isSaving: boolean
  onChange: (preferredCountry: string | null) => void
}) {
  const selectedValue = preferredCountryOptionValueForStored(preferredCountry, countries)

  return (
    <div className="rounded-firm-2 bg-bg-secondary p-4">
      <p className="text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-primary">
        Country of residence
      </p>
      <p className="mt-2 text-sm leading-4.5 tracking-[-0.28px] text-text-secondary">
        Used for delivery estimates and tax on products when you have no default shipping
        address.
      </p>
      <label
        htmlFor="profile-country-residence"
        className="relative mt-4 flex h-14 w-full items-center overflow-hidden rounded-2xl border border-border-secondary px-4"
      >
        <select
          id="profile-country-residence"
          value={selectedValue}
          disabled={isSaving || countries.length === 0}
          onChange={(event) => {
            const optionValue = event.target.value
            if (!optionValue) {
              onChange(null)
              return
            }

            const option = countries.find(
              (row) => preferredCountryOptionValue(row) === optionValue,
            )
            if (!option) return

            onChange(preferredCountryPayloadForOption(option))
          }}
          className={`w-full appearance-none bg-transparent pr-8 text-base leading-5 tracking-[-0.32px] outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
            selectedValue ? 'font-medium text-text-primary' : 'font-normal text-text-tertiary'
          }`}
        >
          <option value="">Select country</option>
          {countries.map((option) => {
            const value = preferredCountryOptionValue(option)
            return (
              <option key={value} value={value}>
                {option.label}
              </option>
            )
          })}
        </select>
        <ArrowDownSLineIcon
          className="pointer-events-none absolute right-4 size-6 text-text-secondary"
          aria-hidden
        />
      </label>
    </div>
  )
}

function DefaultAddressCard({
  address,
  onEdit,
}: {
  address?: DefaultAddress | null
  onEdit: () => void
}) {
  // Nothing is shown when the account has no default address, rather than
  // falling back to the static fixture, which would show a saved-seeming address
  // that does not belong to this user. `isEmpty` guards the branch below, so the
  // empty-object fallback here is only for the type checker.
  const isEmpty = !address
  const shown = address

  return (
    <div className="flex gap-4 rounded-firm-2 bg-bg-secondary p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-primary">
          Default Address
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-primary">
            {isEmpty ? 'No default address saved' : `${shown?.contactName} | ${shown?.phone}`}
          </p>
          {address ? (
            <div className="flex flex-col gap-2 text-sm leading-4.5 tracking-[-0.28px] text-text-primary">
              <p>{address.line1}</p>
              <p>{address.line2}</p>
            </div>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit default address"
        className="cursor-pointer self-start p-0"
      >
        <EditBoxLineIcon className="size-6 text-text-secondary" aria-hidden />
      </button>
    </div>
  )
}

function ProfilePaymentMethodIcon({ type }: { type: PaymentMethodType }) {
  if (type === 'paypal') {
    return (
      <img
        alt=""
        aria-hidden
        className="h-6 w-8 shrink-0 object-contain"
        src={images.footer.paypal}
      />
    )
  }

  if (type === 'visa') {
    return (
      <img
        alt=""
        aria-hidden
        className="h-6 w-8 shrink-0 object-contain"
        src={images.footer.visa}
      />
    )
  }

  return (
    <span
      aria-hidden
      className="flex h-6 w-8 shrink-0 items-center justify-center rounded bg-bg-primary text-[10px] font-semibold leading-none tracking-[-0.2px] text-primary-green"
    >
      MM
    </span>
  )
}

function PaymentMethodCard({
  payment,
  onEdit,
}: {
  payment?: PaymentMethodRecord | null
  onEdit: () => void
}) {
  // The stored network is an enum key, so the API's label list is needed to
  // display it readably.
  const { networks } = usePaymentNetworks()
  const isEmpty = !payment

  return (
    <div className="flex gap-4 rounded-firm-2 bg-bg-secondary p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-primary">
          Payment Method
        </p>
        <div className="mt-4 flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2">
            {isEmpty ? (
              <span className="text-sm leading-4.5 tracking-[-0.28px] text-text-primary">
                No saved payment method
              </span>
            ) : (
              <>
                <span className="text-sm leading-4.5 tracking-[-0.28px] text-text-primary">
                  {paymentTypeLabel(payment.type)}
                </span>
                <ProfilePaymentMethodIcon type={payment.type} />
                {payment.network ? (
                  <span className="text-sm leading-4.5 tracking-[-0.28px] text-text-primary">
                    {/* Stored as an enum key (`mtn`), resolved to the API's label. */}
                    {getPaymentNetworkLabel(networks, payment.network)}
                  </span>
                ) : null}
                <span className="text-sm leading-4.5 tracking-[-0.28px] text-text-primary">
                  {payment.maskedDetail}
                </span>
              </>
            )}
          </div>
          {isEmpty ? null : (
            <p className="text-base leading-5 tracking-[-0.32px] text-text-secondary">
              {payment.cardholderName}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit payment method"
        className="cursor-pointer self-start p-0"
      >
        <EditBoxLineIcon className="size-6 text-text-secondary" aria-hidden />
      </button>
    </div>
  )
}

function PersonalInformationPanel({
  profile,
  onEditProfile,
  onEditAddress,
  onEditPaymentMethod,
  address,
  paymentMethod,
  countries,
  preferredCountry,
  isSavingCountry,
  onPreferredCountryChange,
  isSaving = false,
}: {
  profile: { fullName: string; email: string; initials: string }
  onEditProfile: () => void
  onEditAddress: () => void
  onEditPaymentMethod: () => void
  address?: DefaultAddress | null
  paymentMethod?: PaymentMethodRecord | null
  countries: LookupOption[]
  preferredCountry: string | null
  isSavingCountry: boolean
  onPreferredCountryChange: (preferredCountry: string | null) => void
  isSaving?: boolean
}) {
  return (
    <>
      <div className="flex flex-col gap-4 border-b border-border-primary px-4 py-4 lg:flex-row lg:items-center lg:gap-8 lg:px-6 lg:py-10">
        <div className="flex items-center gap-4 lg:contents">
          <ProfileAvatar initials={profile.initials} />
          <div className="min-w-0 flex-1 lg:flex lg:flex-col lg:gap-2">
            <p className="text-base font-semibold leading-5 tracking-[-0.32px] text-text-primary lg:text-xl lg:leading-6 lg:tracking-[-0.4px]">
              {profile.fullName}
            </p>
            <p className="text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-tertiary">
              {profile.email}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onEditProfile}
          disabled={isSaving}
          className="flex w-fit cursor-pointer items-center justify-center rounded-full bg-text-primary px-4 py-2 text-base font-medium leading-5 tracking-[-0.32px] text-text-inverse disabled:cursor-not-allowed disabled:opacity-60 lg:ml-auto lg:shrink-0"
        >
          {isSaving ? 'Saving…' : 'Edit profile'}
        </button>
      </div>

      <div className="px-4 py-4 lg:px-6">
        <CountryResidenceSelect
          countries={countries}
          preferredCountry={preferredCountry}
          isSaving={isSavingCountry}
          onChange={onPreferredCountryChange}
        />
      </div>

      <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:gap-8 lg:px-6">
        <div className="min-w-0 flex-1">
          <DefaultAddressCard address={address} onEdit={onEditAddress} />
        </div>
        <div className="min-w-0 flex-1">
          <PaymentMethodCard payment={paymentMethod} onEdit={onEditPaymentMethod} />
        </div>
      </div>

      <PrivacyNotice />
    </>
  )
}

function SecurityActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-orange flex h-12 w-27.5 shrink-0 cursor-pointer items-center justify-center rounded-full px-6 text-base font-medium leading-5 tracking-[-0.32px] text-text-inverse"
    >
      {label}
    </button>
  )
}

function SecurityRow({
  title,
  value,
  actionLabel,
  onAction,
}: {
  title: string
  value?: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div className="flex items-center gap-4 border-b border-border-primary py-4">
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
          {title}
        </p>
        {value ? (
          <p className="mt-2 text-sm leading-4.5 tracking-[-0.28px] text-text-primary">{value}</p>
        ) : null}
      </div>
      <SecurityActionButton label={actionLabel} onClick={onAction} />
    </div>
  )
}

function AccountSecurityPanel({ onDeleted }: { onDeleted: () => void }) {
  const { authUser, signOut } = useAuth()
  const [settings, setSettings] = useState<SecuritySettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeAction, setActiveAction] = useState<SecurityAction | null>(null)
  /** Provisioning data from a just-enabled 2FA, shown once then discarded. */
  const [twoFactorSetup, setTwoFactorSetup] = useState<{
    secret: string
    otpauthUrl: string
  } | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadSecurity() {
      try {
        const loaded = await accountApi.getSecurity()
        if (!cancelled) setSettings(loaded)
      } catch {
        if (!cancelled) {
          setSettings({
            email: authUser?.email ?? '',
            phone: null,
            twoFactorEnabled: false,
          })
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadSecurity()

    return () => {
      cancelled = true
    }
  }, [authUser?.email])

  /**
   * Runs the action the dialog collected and folds the server's answer back into
   * the panel. Returns the error to show, or null once the dialog may close.
   */
  const handleSecuritySubmit = async (
    values: SecurityActionValues,
  ): Promise<string | null> => {
    // The dialog only submits while an action is open, so this is unreachable in
    // practice. It is here so the switch below is over a non-nullable union and
    // its exhaustiveness check stays meaningful.
    if (activeAction === null || !settings) return null

    try {
      switch (activeAction) {
        case 'email': {
          const updated = await accountApi.updateEmail(values.email ?? '', values.password ?? '')
          setSettings(updated)
          return null
        }
        case 'phone': {
          const updated = await accountApi.updatePhone(values.phone ?? '')
          setSettings(updated)
          return null
        }
        case 'password': {
          await accountApi.updatePassword(values.currentPassword ?? '', values.password ?? '')
          return null
        }
        case 'twoFactor': {
          if (settings.twoFactorEnabled) {
            await accountApi.disableTwoFactor(values.currentPassword ?? '')
            setSettings({ ...settings, twoFactorEnabled: false })
            return null
          }

          const enrollment = await accountApi.enableTwoFactor()
          setSettings({ ...settings, twoFactorEnabled: enrollment.enabled })
          // The API returns the secret and provisioning URI exactly once and
          // never again, so it is held here for the shopper to add the account to
          // their authenticator app. Not persisted: there is nowhere to keep it
          // that would not outlive its usefulness, and a stored 2FA secret is a
          // standing risk.
          setTwoFactorSetup({
            secret: enrollment.secret,
            otpauthUrl: enrollment.otpauthUrl,
          })
          return null
        }
        case 'deleteAccount': {
          await accountApi.deleteAccount(values.currentPassword ?? '')
          // The account is gone, so the stored session is dead too. Signing out
          // drops those tokens and returns the shopper to a home page whose
          // requests will not all 401 behind them.
          await signOut()
          onDeleted()
          return null
        }
        default: {
          // Exhaustiveness guard: a new action cannot be added without being
          // handled here. The throw is unreachable while `SecurityAction` and
          // this switch stay in step.
          const exhaustiveCheck: never = activeAction
          throw exhaustiveCheck
        }
      }
    } catch (error) {
      return error instanceof ApiError && error.message
        ? error.message
        : 'Something went wrong. Please try again.'
    }
  }

  return (
    <>
      <div className="flex gap-4 border-b border-border-primary px-4 py-4 lg:items-center lg:px-6 lg:py-10">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-green-light p-4">
          <ShieldCheckFillIcon className="size-6 text-primary-green" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
            {accountProtectionTitle}
          </p>
          <p className="mt-2 text-sm leading-4.5 tracking-[-0.28px] text-text-secondary">
            {accountProtectionDescription}
          </p>
        </div>
      </div>

      <div className="px-4 py-4 lg:px-6">
        {isLoading || !settings ? (
          <ListingLoader label="Loading security settings" />
        ) : (
          <>
            <SecurityRow
              title="Email"
              value={settings.email}
              actionLabel="Edit"
              onAction={() => setActiveAction('email')}
            />
            <SecurityRow
              title="Phone"
              value={settings.phone ?? undefined}
              actionLabel={settings.phone ? 'Edit' : 'Add'}
              onAction={() => setActiveAction('phone')}
            />
            <SecurityRow
              title="Password"
              actionLabel="Change"
              onAction={() => setActiveAction('password')}
            />
            <SecurityRow
              title={`Two-factor authentication: ${settings.twoFactorEnabled ? 'On' : 'Off'}`}
              actionLabel={settings.twoFactorEnabled ? 'Turn off' : 'Turn on'}
              onAction={() => setActiveAction('twoFactor')}
            />

            {/*
              Shown only when 2FA was just turned on. The API returns this
              provisioning data once and never again, so dismissing it is
              final — the shopper re-enables to see it if they close early.
            */}
            {twoFactorSetup ? (
              <div className="mt-4 rounded-2xl border border-border-primary bg-bg-secondary p-4">
                <p className="text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
                  Add this to your authenticator app
                </p>
                <p className="mt-2 text-sm leading-4.5 tracking-[-0.28px] text-text-secondary">
                  Enter this setup key, or scan the code in your app. You will be asked for it
                  each time you sign in.
                </p>
                <p className="mt-3 select-all break-all rounded-xl bg-bg-primary px-4 py-3 font-mono text-sm leading-5 text-text-primary">
                  {twoFactorSetup.secret}
                </p>
                <button
                  type="button"
                  onClick={() => setTwoFactorSetup(null)}
                  className="mt-3 h-11 w-fit cursor-pointer rounded-full bg-bg-primary px-5 text-sm font-medium leading-4 tracking-[-0.28px] text-text-primary"
                >
                  Done
                </button>
              </div>
            ) : null}

            <div className="py-4">
              <button
                type="button"
                onClick={() => setActiveAction('deleteAccount')}
                className="flex h-12 cursor-pointer items-center justify-center rounded-full bg-bg-secondary px-6 text-base font-medium leading-5 tracking-[-0.32px] text-text-primary"
              >
                Delete your account
              </button>
            </div>
          </>
        )}
      </div>

      <SecurityActionModal
        action={activeAction ?? 'email'}
        isOpen={activeAction !== null}
        currentPhone={settings?.phone ?? null}
        isTwoFactorEnabled={settings?.twoFactorEnabled ?? false}
        onClose={() => setActiveAction(null)}
        onSubmit={handleSecuritySubmit}
      />
    </>
  )
}

function ProfilePanel({ onSectionChange }: { onSectionChange: (section: AccountSection) => void }) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('personal')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { authUser, refreshSession } = useAuth()
  const navigate = useNavigate()

  /**
   * Leaves the account section after the account itself is deleted. The profile
   * page is the last thing that can read it, so staying would leave a panel full
   * of data the shopper no longer has.
   */
  const handleAccountDeleted = useCallback(() => {
    onSectionChange('orders')
    navigate(getHomePath())
  }, [navigate, onSectionChange])

  /**
   * The signed-in user from `/auth/me` is the source of truth for name and
   * email, since that is what the rest of the app already shows. The profile
   * endpoint can override them and also supplies the default address preview.
   */
  const [profile, setProfile] = useState(() => ({
    fullName: authUser?.fullName ?? '',
    email: authUser?.email ?? '',
    initials: getProfileInitials(authUser?.fullName ?? ''),
  }))
  const [savedPayment, setSavedPayment] = useState<PaymentMethodRecord | null>(null)
  const [countryOptions, setCountryOptions] = useState<LookupOption[]>([])
  const [preferredCountry, setPreferredCountry] = useState<string | null>(null)
  const [isSavingCountry, setIsSavingCountry] = useState(false)

  /**
   * The default address comes from its own hook so Your Profile and Checkout
   * resolve the same record instead of reading it two different ways.
   */
  // ProfilePanel unmounts while the Addresses tab is open, so the hook refetches
  // on its own when the user navigates back.
  const { address: savedAddress, isLoading: isAddressLoading } = useDefaultAddress()

  // Profile details and saved payment methods load together; the default
  // address has its own hook because Checkout reads it too.
  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      setIsLoading(true)
      try {
        const [profileResponse, paymentResponse, lookupCountries] = await Promise.all([
          accountApi.getProfile(),
          accountApi.listPaymentMethods(),
          accountApi.getCountries(),
        ])
        if (cancelled) return

        setCountryOptions(lookupCountries)
        if (profileResponse.profile) {
          const mapped = mapApiProfile(profileResponse.profile)
          setPreferredCountry(
            coercePreferredCountryStoredValue(profileResponse.profile.preferredCountry),
          )
          // `/users/me/profile` may omit the email, in which case the session's
          // email is the accurate one to show.
          setProfile({
            fullName: mapped.fullName || authUser?.fullName || '',
            email: mapped.email || authUser?.email || '',
            initials: getProfileInitials(mapped.fullName || authUser?.fullName || ''),
          })
        }

        const payments = mapApiPaymentMethods(paymentResponse)
        setSavedPayment(payments.find((item) => item.isDefault) ?? payments[0] ?? null)
      } catch {
        // Session values from authUser remain; no fabricated profile rows.
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [authUser])

  /** Saves the new name, then refreshes the session so the Nav updates too. */
  const handleProfileUpdate = async (fullName: string) => {
    setErrorMessage(null)
    setIsSaving(true)

    try {
      const response = await accountApi.updateProfile({ fullName })
      setProfile(
        response.profile
          ? mapApiProfile(response.profile)
          : { fullName, email: profile.email, initials: getProfileInitials(fullName) },
      )
      await refreshSession().catch(() => undefined)
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError && error.message
          ? error.message
          : 'We could not update your profile. Please try again.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handlePreferredCountryChange = async (next: string | null) => {
    setErrorMessage(null)
    const previous = preferredCountry
    setPreferredCountry(next)
    writeStoredPreferredCountry(authUser?.email ?? undefined, next)
    setIsSavingCountry(true)

    try {
      const response = await accountApi.updatePreferredCountry(next)
      const saved = response.preferredCountry ?? next
      setPreferredCountry(saved)
      writeStoredPreferredCountry(authUser?.email ?? undefined, saved)
      notifyPreferredCountryChanged()
    } catch (error) {
      setPreferredCountry(previous)
      writeStoredPreferredCountry(authUser?.email ?? undefined, previous)
      setErrorMessage(
        error instanceof ApiError && error.message
          ? error.message
          : 'We could not update your country of residence. Please try again.',
      )
    } finally {
      setIsSavingCountry(false)
    }
  }

  return (
    <>
      <EditProfileModal
        isOpen={isEditModalOpen}
        fullName={profile.fullName}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={(fullName) => void handleProfileUpdate(fullName)}
      />

      <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {errorMessage ? (
        <p
          role="alert"
          className="mx-4 mt-4 rounded-xl bg-orange-light px-4 py-3 text-sm font-medium leading-4.5 tracking-[-0.28px] text-primary-orange lg:mx-6"
        >
          {errorMessage}
        </p>
      ) : null}

      {activeTab === 'personal' ? (
        isLoading || isAddressLoading ? (
          <ListingLoader label="Loading profile" />
        ) : (
          <PersonalInformationPanel
            profile={profile}
            onEditProfile={() => setIsEditModalOpen(true)}
            isSaving={isSaving}
            address={savedAddress}
            paymentMethod={savedPayment}
            countries={countryOptions}
            preferredCountry={preferredCountry}
            isSavingCountry={isSavingCountry}
            onPreferredCountryChange={(value) => void handlePreferredCountryChange(value)}
            onEditAddress={() => onSectionChange('addresses')}
            onEditPaymentMethod={() => onSectionChange('payments')}
          />
        )
      ) : (
        <AccountSecurityPanel onDeleted={handleAccountDeleted} />
      )}
    </>
  )
}

function BuyAgainSidebar({
  orders,
  ordersLoading,
  onAddToCart,
}: {
  orders: OrderRecord[]
  ordersLoading: boolean
  onAddToCart: (productId: string) => void
}) {
  const [suggested, setSuggested] = useState<BuyAgainProduct[] | null>(null)
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadSuggestions() {
      setIsSuggestionsLoading(true)
      try {
        const response = await ordersApi.getBuyAgainProducts()
        if (cancelled) return

        setSuggested(
          response.products.map((item) => {
            const product = mapApiProduct(item)
            return {
              id: product.id,
              name: product.name,
              price: product.price,
              image: product.image,
            }
          }),
        )
      } catch {
        if (!cancelled) {
          setSuggested(null)
        }
      } finally {
        if (!cancelled) {
          setIsSuggestionsLoading(false)
        }
      }
    }

    void loadSuggestions()

    return () => {
      cancelled = true
    }
  }, [])

  // The API's suggestions lead. When they are unavailable or empty, the rail
  // falls back to products from the orders actually on screen, so it only ever
  // advertises something this customer has bought. There is deliberately no
  // static fallback: showing placeholder products would be inventing purchases.
  const purchasedProducts = getBuyAgainProductsFromOrders(orders)
  const products =
    suggested && suggested.length > 0 ? suggested : purchasedProducts
  const isLoading = ordersLoading || isSuggestionsLoading

  return (
    <aside className="hidden w-37.5 shrink-0 flex-col overflow-hidden rounded-2xl border border-border-primary xl:flex">
      <div className="border-b border-border-primary px-2 py-3">
        <p className="text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
          Buy this again
        </p>
      </div>
      <div className="flex flex-col gap-2 p-2">
        {isLoading ? (
          <ListingLoader label="Loading buy again" />
        ) : products.length > 0 ? (
          products.map((product) => (
            <BuyAgainProductCard
              key={product.id}
              product={product}
              onAddToCart={onAddToCart}
            />
          ))
        ) : (
          <p className="px-2 py-6 text-center text-sm leading-4.5 tracking-[-0.28px] text-text-secondary">
            Nothing to buy again yet. Products you order will appear here.
          </p>
        )}
      </div>
    </aside>
  )
}

export function YourOrdersView({
  onGoHome,
  section,
  onSectionChange,
  onViewRefundPolicy,
  startEditingDefaultAddress = false,
  onDismissEditIntent,
  startAddingResidenceAddress = false,
  onDismissResidenceAddIntent,
}: YourOrdersViewProps) {
  // Orders live here so the panel and the "Buy this again" rail read from the
  // same list, which keeps the rail's products tied to real purchases.
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const { addBuyAgainProductToCart } = useBuyAgain()

  return (
    <>
      <AccountBreadcrumbs onGoHome={onGoHome} section={section} />

      <section className="border-t border-border-primary px-4 pb-10 pt-6 lg:px-16 lg:pt-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <AccountSidebar activeSection={section} onSectionChange={onSectionChange} />

          <div className="min-w-0 flex-1">
            {section === 'orders' ? (
              <OrdersPanel
                onViewRefundPolicy={onViewRefundPolicy}
                onOrdersChange={setOrders}
                onLoadingChange={setOrdersLoading}
              />
            ) : section === 'reviews' ? (
              <ReviewsPanel />
            ) : section === 'profile' ? (
              <ProfilePanel onSectionChange={onSectionChange} />
            ) : section === 'history' ? (
              <BrowsingHistoryPanel />
            ) : section === 'addresses' ? (
              <AddressesPanel
                startEditingDefault={startEditingDefaultAddress}
                onDismissEditIntent={onDismissEditIntent}
                startAddingResidenceAddress={startAddingResidenceAddress}
                onDismissResidenceAddIntent={onDismissResidenceAddIntent}
              />
            ) : section === 'payments' ? (
              <PaymentMethodsPanel />
            ) : (
              <NotificationsPanel />
            )}
          </div>

          {section === 'orders' ? (
            <BuyAgainSidebar
              orders={orders}
              ordersLoading={ordersLoading}
              onAddToCart={(productId) => {
                void addBuyAgainProductToCart(productId)
              }}
            />
          ) : null}
        </div>
      </section>
    </>
  )
}
