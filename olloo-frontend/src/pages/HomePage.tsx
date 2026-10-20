import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { accountApi, catalogApi, checkoutApi } from '../api'
import { ApiError } from '../api/client'
import {
  clearPendingPayment,
  readPendingPayment,
  savePendingPayment,
} from '../api/pendingPayment'
import { buildSelectionForProduct, mapApiProduct, mapApiProductDetail } from '../api/mappers'
import { BackToTopButton } from '../components/BackToTopButton'
import { CategoryListingView } from '../components/CategoryListingView'
import { ProductDetailView } from '../components/ProductDetailView'
// import { FeaturesSection } from '../components/FeaturesSection'
import { Footer } from '../components/Footer'
import { HomeLanding } from '../components/HomeLanding'
import { Nav } from '../components/Nav'
import type { MobileNavTab } from '../components/MobileAppNavigation'
import { CartView } from '../components/CartView'
import { CheckoutView } from '../components/CheckoutView'
import { AddAddressRequiredModal } from '../components/AddAddressRequiredModal'
import { PaymentErrorModal } from '../components/PaymentErrorModal'
import { PaymentRedirectOverlay } from '../components/PaymentRedirectOverlay'
import { OrderCompletedView } from '../components/OrderCompletedView'
import { PaymentReturnView } from '../components/PaymentReturnView'
import { WishlistView } from '../components/WishlistView'
import { SearchResultsView } from '../components/SearchResultsView'
import { useAuth } from '../context/AuthContext'
import { useCatalog } from '../context/CatalogContext'
import { HomePlacementsProvider } from '../context/HomePlacementsContext'
import { useShop } from '../context/ShopContext'
import { useProductDestination } from '../hooks/useProductDestination'
import { useDefaultAddress } from '../hooks/useDefaultAddress'
import { findSubcategorySlugByLabel } from '../data/catalogCategories'
import { getAllCategoriesListingSelection } from '../data/categoryListing'
import { useCategoryNavigation } from '../hooks/useCategoryNavigation'
import type { CartStep, PaymentReturnStep } from '../data/navigation'
import {
  getOrderIdempotencyKey,
  getPaymentIntentIdempotencyKey,
  resetCheckoutAttemptKeys,
} from '../api/idempotency'
import type { OrderConflict } from '../data/orderConflicts'
import { toOrderConflict } from '../data/orderConflicts'
import { isPaymentMethodRejection } from '../data/checkoutPaymentMethods'
import {
  ORDER_CONFLICT_CODES,
  type OrderConflictCode,
} from '../api/types'
import type { Product } from '../data/products'
import type { ProductDetailContext } from '../data/productDetail'
import {
  ADD_RESIDENCE_ADDRESS_PARAM,
  EDIT_DEFAULT_ADDRESS_PARAM,
  getAccountPath,
} from '../data/accountRoutes'
import { writeResidenceAddressIntent } from '../api/residenceAddressIntent'
import {
  getAddressResidenceMismatch,
  type AddressResidenceMismatch,
} from '../utils/addressResidenceMatch'
import { CountryResidenceMismatchModal } from '../components/CountryResidenceMismatchModal'
import {
  getCartPath,
  getCategoryPathFromSelection,
  getCheckoutPath,
  getHomePath,
  getOrderCompletePath,
  getPaymentCancelPath,
  getPaymentReturnPath,
  getProductPath,
  getProductPathForListingSelection,
  getSearchQuery,
  getWishlistPath,
  parseCategoryRoute,
} from '../data/shopRoutes'

export type { CartStep } from '../data/navigation'

/** Narrows an API error code to a known order-time conflict. */
function isOrderConflictCode(code: string): code is OrderConflictCode {
  return (ORDER_CONFLICT_CODES as readonly string[]).includes(code)
}

export function HomePage() {
  const { authUser, requestSignIn } = useAuth()
  const { categories } = useCatalog()
  const { cartItems, clearCart, setLastOrder, refreshCart } = useShop()
  // The account's default address, resolved from the addresses list. Checkout
  // reads the same record, and `POST /orders` needs its rid when the checkout
  // preview omits `defaultAddressRid`.
  const { address: defaultAddress } = useDefaultAddress()
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams()
  const [searchParams] = useSearchParams()
  const [productDetail, setProductDetail] = useState<ProductDetailContext | null>(null)
  const [isProductLoading, setIsProductLoading] = useState(false)
  const [isStartingPayment, setIsStartingPayment] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  /** The shopper's chosen payment method, sent as `paymentMethodId`. */
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null)
  /** Set when checkout was blocked because no default address is set. */
  const [isAddAddressModalOpen, setIsAddAddressModalOpen] = useState(false)
  /** Set when `POST /orders` returned a 409 the shopper needs to act on. */
  const [orderConflict, setOrderConflict] = useState<OrderConflict | null>(null)
  /**
   * Progress step shown on the blocking overlay between submitting and the
   * provider redirect, so the wait is explained rather than blank.
   */
  const [paymentRedirectStep, setPaymentRedirectStep] = useState<string | null>(null)
  /** Payment failure surfaced as a modal instead of an inline banner. */
  const [paymentError, setPaymentError] = useState<{
    message: string
    isOrderPlaced: boolean
  } | null>(null)
  const [residenceMismatch, setResidenceMismatch] = useState<AddressResidenceMismatch | null>(
    null,
  )
  const skipResidenceMismatchCheckRef = useRef(false)
  const pathname = location.pathname
  const productId = pathname.startsWith('/products/') ? params.productId : undefined
  const categoryListing = useMemo(() => {
    if (!pathname.startsWith('/categories')) {
      return null
    }

    return parseCategoryRoute(params.categoryId, searchParams.get('subcategory'), categories)
  }, [categories, params.categoryId, pathname, searchParams])

  useEffect(() => {
    if (!pathname.startsWith('/categories/') || !params.categoryId) {
      return
    }

    const legacySubcategory = searchParams.get('subcategory')
    if (!legacySubcategory) {
      return
    }

    const slug = findSubcategorySlugByLabel(params.categoryId, legacySubcategory, categories)
    if (!slug) {
      return
    }

    navigate(`/categories/${slug}`, { replace: true })
  }, [categories, navigate, params.categoryId, pathname, searchParams])

  const cartStep: CartStep | null =
    pathname === '/cart'
      ? 'cart'
      : pathname === '/checkout'
        ? 'checkout'
        : pathname === '/order-complete'
          ? 'completed'
          : null

  // The provider redirects here after checkout. Only `?reference` is trusted, so
  // the page polls `GET /payments/:reference` for the actual outcome.
  const paymentReturnStep: PaymentReturnStep | null =
    pathname === getPaymentReturnPath()
      ? 'payment-return'
      : pathname === getPaymentCancelPath()
        ? 'payment-cancel'
        : null
  const paymentReference = searchParams.get('reference')

  // While browsing a category, keep the link bar pointed at it. Falls back to
  // whichever category the modal was last opened with (homepage, search, etc).
  // Grouped members (e.g. "accessories" under "Fashion & Accessories") resolve to
  // their major category so the link bar always highlights the right entry.
  const {
    activeCategoryId,
    categoriesTargetId,
    closeCategories,
    handleSubcategorySelect,
    isCategoriesOpen,
    openCategories,
    openToInitialCategory,
    toggleCategories,
    toggleCategoriesFromLinkBar,
  } = useCategoryNavigation({
    scrollOnNavigate: true,
    routeCategoryId: categoryListing ? categoryListing.categoryId : undefined,
  })
  const wishlistOpen = pathname === '/wishlist'
  const searchOpen = pathname === '/search'
  const searchQuery = getSearchQuery(searchParams)
  // The detail response's delivery estimate and shipping fee are only populated
  // for a known destination, so the fetch carries one.
  const { country } = useProductDestination()

  useEffect(() => {
    if (!productId) {
      setProductDetail(null)
      return
    }

    let cancelled = false
    setIsProductLoading(true)

    async function loadProductDetail() {
      try {
        const response = await catalogApi.getProductDetail(productId!, { country })
        const selection = buildSelectionForProduct(
          mapApiProduct(response.product),
          searchParams.get('from'),
          searchParams.get('category'),
          searchParams.get('subcategory'),
          categories,
        )
        if (!cancelled) {
          setProductDetail(mapApiProductDetail(response, selection))
          // Recorded only once the detail resolved, so a failed lookup does not
          // leave a history entry for a page that never rendered.
          void accountApi.recordBrowsingHistory(productId!).catch(() => undefined)
        }
      } catch {
        if (!cancelled) {
          setProductDetail(null)
          navigate(getHomePath(), { replace: true })
        }
      } finally {
        if (!cancelled) {
          setIsProductLoading(false)
        }
      }
    }

    void loadProductDetail()

    return () => {
      cancelled = true
    }
  }, [categories, country, navigate, productId, searchParams])

  useEffect(() => {
    if (pathname.startsWith('/categories/') && params.categoryId && !categoryListing) {
      navigate(getHomePath(), { replace: true })
    }
  }, [categoryListing, navigate, params.categoryId, pathname])

  useEffect(() => {
    // Order-first checkout empties the cart by design: `POST /orders` moves the
    // ordered lines out before payment opens. Redirecting to `/cart` at that
    // moment flashed "Your cart is empty" at the shopper mid-purchase, so the
    // guard is skipped while the handoff to the provider is in flight. The
    // overlay covers the page for the same window.
    if (paymentRedirectStep) return
    // A payment failure after the order was placed also leaves the cart empty,
    // and bouncing to `/cart` would dismiss the error modal before it was read.
    if (paymentError?.isOrderPlaced) return
    if (pathname === '/checkout' && cartItems.length === 0) {
      navigate(getCartPath(), { replace: true })
    }
  }, [cartItems.length, navigate, paymentError, paymentRedirectStep, pathname])

  useEffect(() => {
    if (pathname !== '/cart') return
    void refreshCart()
  }, [pathname, refreshCart])

  const handleOpenAllCategories = useCallback(() => {
    navigate(getCategoryPathFromSelection(getAllCategoriesListingSelection(categories), categories))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [categories, navigate])

  const handleGoHome = useCallback(() => {
    navigate(getHomePath())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [navigate])

  const handleBackToListing = useCallback(() => {
    if (!productDetail) return
    navigate(getCategoryPathFromSelection(productDetail.selection, categories))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [navigate, productDetail])

  const handleProductSelect = useCallback(
    (product: Product) => {
      if (!categoryListing) return
      navigate(getProductPathForListingSelection(product.id, categoryListing, categories))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [categories, categoryListing, navigate],
  )

  const handleNewArrivalProductSelect = useCallback(
    (product: Product) => {
      navigate(getProductPath(product.id, { from: 'home' }))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [navigate],
  )

  const handleFeaturedProductSelect = useCallback(
    (product: Product) => {
      navigate(getProductPath(product.id, { from: 'featured' }))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [navigate],
  )

  const handleOpenCart = useCallback(() => {
    closeCategories()
    navigate(getCartPath())
    void refreshCart()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [closeCategories, navigate, refreshCart])

  // Cart lines carry no category context, so the product page falls back to the
  // product's own category/subcategory for its breadcrumb and "back" target.
  const handleCartProductSelect = useCallback(
    (productId: string) => {
      navigate(getProductPath(productId))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [navigate],
  )

  const handleSearchProductSelect = useCallback(
    (product: Product) => {
      navigate(getProductPath(product.id))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [navigate],
  )

  const handleOpenWishlist = useCallback(() => {
    closeCategories()
    navigate(getWishlistPath())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [closeCategories, navigate])

  const handleWishlistProductSelect = useCallback(
    (product: Product) => {
      navigate(getProductPath(product.id, { from: 'wishlist' }))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [navigate],
  )

  const handleGoToCart = useCallback(() => {
    navigate(getCartPath())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [navigate])

  const handleCheckout = useCallback(() => {
    if (cartItems.length === 0) return

    // Checkout places an order, which the backend only accepts for a signed-in
    // user. Prompt to sign in first instead of landing on a page that cannot submit.
    if (!authUser) {
      requestSignIn()
      return
    }

    navigate(getCheckoutPath())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [authUser, cartItems.length, navigate, requestSignIn])

  /**
   * "Change address" just lands on the Addresses tab, where the user picks one.
   * "Edit" goes there too, but flags the intent so the panel opens its edit form
   * for the default address instead of only listing them.
   */
  const handleGoToAddresses = useCallback(() => {
    navigate(getAccountPath('addresses'))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [navigate])

  const handleEditDefaultAddress = useCallback(() => {
    navigate(`${getAccountPath('addresses')}${EDIT_DEFAULT_ADDRESS_PARAM}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [navigate])

/**
 * Places the order, then opens payment for it.
   *
   * Order-first checkout: `POST /orders` creates the order awaiting payment with
   * totals fixed and stock held, and the ordered lines leave the cart. Only then
   * is `POST /checkout/payment-intent` called for that exact order, which opens
   * provider checkout for the order total.
   *
   * Each call carries its own idempotency key, because the server stores one
   * record per key and rejects a key replayed with a different body
   * (`422 idempotency_key_reused`). Retrying either call reuses that call's key,
   * so a network error replays the stored response instead of creating a second
   * order. Keys are regenerated only after a `price_changed` conflict, which is
   * a new decision rather than a retry of the same one.
   */
  const handleSubmitOrder = useCallback(async () => {
    if (!authUser) return

    const selectedItemIds = cartItems.filter((item) => item.selected).map((item) => item.id)
    if (selectedItemIds.length === 0) return

    setCheckoutError(null)
    setOrderConflict(null)
    setPaymentError(null)

    // The order is placed before payment, so this flag is what distinguishes
    // "payment never opened" from "payment failed on an order that exists".
    // It is set as soon as `POST /orders` succeeds and read in the catch.
    let orderWasPlaced = false

    // Set immediately before the browser leaves for the provider. `finally` runs
    // synchronously after `window.location.href = …`, but assigning a location
    // does not unload the page on its own, so the `finally` clearing the overlay
    // was briefly revealing the now-empty cart underneath it.
    let isLeavingForProvider = false

    try {
      setIsStartingPayment(true)

      const preview = await checkoutApi.getCheckoutPreview()
      // `defaultAddressRid` is only sent once the backend knows which address it
      // should treat as default, so it can be absent even when the account has a
      // saved default address. `useDefaultAddress` already resolved that record
      // from the addresses list (the entry flagged `isDefault`), and its rid is
      // the same value `POST /orders` expects. Falling back to it is what stops a
      // shopper who has an address from being told they have none.
      const addressId = preview.defaultAddressRid ?? preview.address?.rid ?? defaultAddress?.rid
      if (!addressId) {
        // An inline error here would leave the shopper stuck on a page with no
        // way forward, so prompt them to add an address instead.
        setIsAddAddressModalOpen(true)
        return
      }

      if (!paymentMethodId) {
        setCheckoutError('Choose a payment method before submitting your order.')
        return
      }

      const skipMismatchCheck = skipResidenceMismatchCheckRef.current
      skipResidenceMismatchCheckRef.current = false

      if (!skipMismatchCheck) {
        const mismatch = await getAddressResidenceMismatch(defaultAddress, authUser.email)
        if (mismatch) {
          setResidenceMismatch(mismatch)
          return
        }
      }

      // The two calls get separate keys: they carry different bodies, and the
      // server rejects one key reused with a different body
      // (`422 idempotency_key_reused`).
      const orderKey = getOrderIdempotencyKey()

      setPaymentRedirectStep('Placing your order…')
      const order = await checkoutApi.placeOrder(
        { addressId, cartItemIds: selectedItemIds },
        orderKey,
      )

      // The order exists now. From here on a failure means "not paid", not
      // "not ordered", which changes what the shopper is told to do next.
      orderWasPlaced = true

      // The order exists now, so its lines have already left the cart. Refresh
      // before the redirect so a failed payment does not show them again.
      setPaymentRedirectStep('Opening secure payment…')
      await refreshCart()

      const intent = await checkoutApi.createPaymentIntent(
        order.orderId,
        // Rotated automatically if the shopper picks a different method, since
        // that is a new request rather than a retry of this one.
        getPaymentIntentIdempotencyKey(paymentMethodId ?? undefined),
        // Resolved by the backend from either a rid or a code.
        paymentMethodId ?? undefined,
      )

      // Kept so the return page can poll payment status. The order already
      // exists, so only the payment details are pending.
      savePendingPayment({
        paymentRid: intent.paymentRid,
        provider: intent.provider,
        orderId: order.orderId,
        orderReference: order.orderReference,
        estimatedDelivery: order.estimatedDelivery,
      })

      setLastOrder({
        orderId: order.orderId,
        orderReference: order.orderReference,
        estimatedDelivery: order.estimatedDelivery,
      })

      // Full-page navigation is required: the provider page is external and
      // React Router cannot own it. The overlay is deliberately left up until the
      // browser actually leaves.
      isLeavingForProvider = true
      window.location.href = intent.checkoutUrl
    } catch (error) {
      if (error instanceof ApiError && error.code && isOrderConflictCode(error.code)) {
        // The order was not created and the cart is untouched. Show what changed
        // and let the shopper decide; the next attempt needs a new key because
        // they are agreeing to new prices. This stays inline because it is a
        // decision to make, not a payment failure.
        setOrderConflict(toOrderConflict(error.code, error.details))
      } else if (isPaymentMethodRejection(error)) {
        // The chosen method is no longer payable: unknown (404), does not serve
        // the order currency (422), or the provider declined the shopper (422,
        // e.g. Tabby). The order exists awaiting payment, so this is recoverable
        // by retrying with a different method — and a retry of the same decision
        // reuses the idempotency key.
        //
        // Clearing the selection forces the list to reload, so the shopper
        // cannot silently resubmit the method that just failed.
        setPaymentMethodId(null)
        setCheckoutError(
          error instanceof ApiError && error.message
            ? error.message
            : 'That payment method is unavailable. Please choose another.',
        )
      } else {
        // Payment could not be opened. This is shown as a modal rather than the
        // inline banner: the shopper is mid-purchase and the banner is easy to
        // miss, so the failure and the way out are put in front of them.
        setPaymentError({
          message:
            error instanceof ApiError && error.message
              ? error.message
              : 'We could not start the payment. Please try again later.',
          isOrderPlaced: orderWasPlaced,
        })
      }
    } finally {
      setIsStartingPayment(false)
      // Not cleared once the browser has been sent to the provider: assigning a
      // location does not unload the page synchronously, so clearing here tore
      // down the overlay while the empty cart was still on screen, which is what
      // the shopper was seeing before the provider page appeared.
      if (!isLeavingForProvider) {
        setPaymentRedirectStep(null)
      }
    }
  }, [authUser, cartItems, defaultAddress, paymentMethodId, refreshCart, setLastOrder])

  const handleAddAddressForResidenceFromCheckout = useCallback(() => {
    if (!residenceMismatch) return

    writeResidenceAddressIntent(residenceMismatch.residenceCountryCode)
    setResidenceMismatch(null)
    navigate(`${getAccountPath('addresses')}${ADD_RESIDENCE_ADDRESS_PARAM}`)
  }, [navigate, residenceMismatch])

  const handleProceedAnywayFromCheckout = useCallback(() => {
    setResidenceMismatch(null)
    skipResidenceMismatchCheckRef.current = true
    void handleSubmitOrder()
  }, [handleSubmitOrder])

  /**
   * Retries checkout after a payment failure that left no order behind.
   *
   * The keys are reset first: the previous attempt's `POST /orders` either was
   * never sent or failed, so replaying that key could return the stored response
   * for a body the shopper has since changed. Only offered when no order was
   * created -- once one exists the lines have left the cart and resubmitting
   * would place a duplicate.
   */
  const handleRetryCheckout = useCallback(() => {
    resetCheckoutAttemptKeys()
    setPaymentError(null)
    void handleSubmitOrder()
  }, [handleSubmitOrder])

  /**
   * Return leg: the payment succeeded.
   *
   * The order already exists -- order-first checkout created it before the
   * redirect -- so there is nothing to place here. This only reconciles the
   * confirmation, guarded on the stored rid so a re-render or a repeat visit
   * cannot run it twice.
   */
  const handleCompletePaidOrder = useCallback(
    async (paymentRid: string) => {
      const stored = readPendingPayment()
      if (!stored || stored.paymentRid !== paymentRid) return

      clearPendingPayment()
      // The attempt succeeded, so the next checkout is a new decision.
      resetCheckoutAttemptKeys()
      setLastOrder({
        orderId: stored.orderId,
        orderReference: stored.orderReference,
        estimatedDelivery: stored.estimatedDelivery,
      })
      clearCart()
      await refreshCart()
      navigate(getOrderCompletePath())
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [clearCart, navigate, refreshCart, setLastOrder],
  )

  /**
   * Once the payment is confirmed the order already exists, so the confirmation
   * page takes over. Errors are intentionally swallowed here — the return view
   * already reports the payment outcome and offers a retry.
   */
  useEffect(() => {
    if (paymentReturnStep !== 'payment-return' || !paymentReference) return

    void handleCompletePaidOrder(paymentReference).catch(() => undefined)
  }, [handleCompletePaidOrder, paymentReference, paymentReturnStep])

  const handlePaymentReturnHome = useCallback(() => {
    clearPendingPayment()
    navigate(getHomePath())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [navigate])

  const handleRelatedProductSelect = useCallback(
    (product: Product) => {
      if (!productDetail) return
      navigate(
        getProductPathForListingSelection(product.id, productDetail.selection, categories),
      )
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [categories, navigate, productDetail],
  )

  const mobileActiveTab: MobileNavTab = cartStep
    ? 'cart'
    : wishlistOpen
      ? 'favourite'
      : categoryListing || productDetail
        ? 'categories'
        : 'home'

  const showProductDetail = Boolean(productId && (productDetail || isProductLoading))

  return (
    <>
      <Nav
        isCategoriesOpen={isCategoriesOpen}
        categoriesTargetId={categoriesTargetId}
        onToggleCategories={toggleCategories}
        onCloseCategories={closeCategories}
        onSubcategorySelect={handleSubcategorySelect}
        onOpenCart={handleOpenCart}
        onOpenWishlist={handleOpenWishlist}
        mobileActiveTab={mobileActiveTab}
        onMobileHome={handleGoHome}
        // The link bar is part of the site header, so it shows on every view
        // (product detail, cart, wishlist, checkout) just like the other pages.
        showCategoryLinksBar
        onOpenCategories={toggleCategoriesFromLinkBar}
        activeCategoryId={activeCategoryId}
        openToInitialCategory={openToInitialCategory}
      />
      <div className="mx-auto w-full min-w-0 max-w-360 overflow-x-clip bg-bg-primary">
        {paymentReturnStep ? (
          <>
            <main>
              <PaymentReturnView
                outcome={paymentReturnStep === 'payment-cancel' ? 'cancel' : 'return'}
                reference={paymentReference}
                onGoHome={handlePaymentReturnHome}
                onGoToCart={handleGoToCart}
              />
            </main>
            <Footer onOpenCategories={openCategories} />
          </>
        ) : showProductDetail ? (
          <>
            <main>
              {productDetail ? (
                <ProductDetailView
                  context={productDetail}
                  onGoHome={handleGoHome}
                  onBackToListing={handleBackToListing}
                  onGoToCart={handleOpenCart}
                  onProductSelect={handleRelatedProductSelect}
                />
              ) : (
                <div className="flex min-h-96 items-center justify-center px-4 py-16 text-text-secondary">
                  Loading product...
                </div>
              )}
            </main>
            <Footer onOpenCategories={openCategories} />
          </>
        ) : cartStep ? (
          <>
            <main>
              {cartStep === 'cart' ? (
                <CartView
                  onGoHome={handleGoHome}
                  onCheckout={handleCheckout}
                  onGoToProduct={handleCartProductSelect}
                />
              ) : cartStep === 'checkout' ? (
                <CheckoutView
                  onGoHome={handleGoHome}
                  onGoToCart={handleGoToCart}
                  onGoToProduct={handleCartProductSelect}
                  onSubmitOrder={() => void handleSubmitOrder()}
                  onGoToAddresses={handleGoToAddresses}
                  onPaymentMethodChange={setPaymentMethodId}
                  onEditDefaultAddress={handleEditDefaultAddress}
                  isSubmitting={isStartingPayment}
                  submitError={checkoutError}
                  orderConflict={orderConflict}
                  onAcknowledgeConflict={() => {
                    // Acknowledging the new prices is a new decision, so the
                    // next attempt must not replay the previous one.
                    resetCheckoutAttemptKeys()
                    setOrderConflict(null)
                  }}
                />
              ) : (
                <OrderCompletedView onGoHome={handleGoHome} />
              )}
            </main>
            <Footer onOpenCategories={openCategories} />
            <AddAddressRequiredModal
              isOpen={isAddAddressModalOpen}
              onClose={() => setIsAddAddressModalOpen(false)}
              onContinue={() => {
                setIsAddAddressModalOpen(false)
                handleGoToAddresses()
              }}
            />
            <CountryResidenceMismatchModal
              isOpen={residenceMismatch !== null}
              mismatch={residenceMismatch}
              onClose={() => {
                setResidenceMismatch(null)
              }}
              onAddAddressForResidence={handleAddAddressForResidenceFromCheckout}
              onProceedAnyway={handleProceedAnywayFromCheckout}
            />
            <PaymentRedirectOverlay
              isVisible={paymentRedirectStep !== null}
              message={paymentRedirectStep ?? ''}
            />
            <PaymentErrorModal
              isOpen={paymentError !== null}
              message={paymentError?.message ?? ''}
              isOrderPlaced={paymentError?.isOrderPlaced ?? false}
              onClose={() => {
                // Once the order exists the cart is empty, so dismissing here
                // would otherwise drop the shopper on "Your cart is empty" with
                // no way back to the order they still owe payment on. Send them
                // to the order instead, which is where the retry actually lives.
                if (paymentError?.isOrderPlaced) {
                  setPaymentError(null)
                  navigate(getAccountPath('orders'))
                  return
                }

                setPaymentError(null)
              }}
              onRetry={handleRetryCheckout}
              onViewOrders={() => {
                setPaymentError(null)
                navigate(getAccountPath('orders'))
              }}
            />
          </>
        ) : wishlistOpen ? (
          <>
            <main>
              <WishlistView
                onGoHome={handleGoHome}
                onProductSelect={handleWishlistProductSelect}
              />
            </main>
            <Footer onOpenCategories={openCategories} />
          </>
        ) : categoryListing ? (
          <>
            <main>
              <CategoryListingView
                selection={categoryListing}
                onGoHome={handleGoHome}
                onProductSelect={handleProductSelect}
                onSeeAllProducts={handleOpenAllCategories}
              />
            </main>
            <Footer onOpenCategories={openCategories} />
          </>
        ) : searchOpen ? (
          <>
            <main>
              <SearchResultsView
                query={searchQuery}
                onGoHome={handleGoHome}
                onProductSelect={handleSearchProductSelect}
                onSeeAllProducts={handleOpenAllCategories}
              />
            </main>
            <Footer onOpenCategories={openCategories} />
          </>
        ) : (
          <HomePlacementsProvider>
            <HomeLanding
              onOpenCategories={(categoryId) => openCategories(String(categoryId))}
              onNewArrivalProductSelect={handleNewArrivalProductSelect}
              onFeaturedProductSelect={handleFeaturedProductSelect}
              onShopAllCategories={handleOpenAllCategories}
            />
          </HomePlacementsProvider>
        )}
      </div>
      <BackToTopButton />
    </>
  )
}
