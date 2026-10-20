import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { cartApi, wishlistApi } from '../api'
import { clearLastOrder, readLastOrder, saveLastOrder } from '../api/lastOrder'
import { mapApiCartItem, mapApiProduct } from '../api/mappers'
import type { CartSummary } from '../api/types'
import type { CartItem } from '../data/cart'
import { getCartErrorMessage } from '../data/cartErrors'
import type { LastOrder } from '../data/lastOrder'
import type { Product } from '../data/products'
import { getProductKey } from '../data/products'
import { useAuth } from './AuthContext'

type ShopContextValue = {
  cartItems: CartItem[]
  cartItemCount: number
  cartSummary: CartSummary | null
  isCartLoading: boolean
  /** Explains a rejected cart mutation, e.g. exceeding available stock. */
  cartError: string | null
  clearCartError: () => void
  refreshCart: () => Promise<void>
  /** Applies a cart response the caller already has, avoiding a redundant GET. */
  applyCartResponse: (response: Awaited<ReturnType<typeof cartApi.getCart>>) => void
  addToCart: (product: Product, quantity?: number, variantId?: string) => Promise<void>
  findCartItemForProduct: (product: Product, variantId?: string) => CartItem | undefined
  updateCartItem: (itemId: string, patch: { quantity?: number; selected?: boolean }) => Promise<void>
  removeCartItem: (itemId: string) => Promise<void>
  removeSelectedCartItems: () => Promise<void>
  selectAllCartItems: (selected: boolean) => Promise<void>
  moveSelectedToWishlist: () => Promise<void>
  wishlistProducts: Product[]
  isWishlistLoading: boolean
  refreshWishlist: () => Promise<void>
  isLiked: (productId: string) => boolean
  toggleWishlist: (product: Product) => Promise<void>
  removeFromWishlist: (product: Product) => Promise<void>
  clearCart: () => void
  lastOrder: LastOrder | null
  setLastOrder: (order: LastOrder | null) => void
}

const ShopContext = createContext<ShopContextValue | null>(null)

function applyCartResponse(
  setCartItems: (items: CartItem[]) => void,
  setCartSummary: (summary: CartSummary | null) => void,
  response: Awaited<ReturnType<typeof cartApi.getCart>>,
) {
  setCartItems(response.items.map(mapApiCartItem))
  setCartSummary(response.summary)
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const { authUser, requestSignIn } = useAuth()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [cartSummary, setCartSummary] = useState<CartSummary | null>(null)
  // Starts true so the first paint waits for the cart instead of flashing the
  // empty state before the fetch resolves. `refreshCart` clears it on settle.
  const [isCartLoading, setIsCartLoading] = useState(true)
  /** Explains a rejected cart mutation (e.g. not enough stock). */
  const [cartError, setCartError] = useState<string | null>(null)
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([])
  const [isWishlistLoading, setIsWishlistLoading] = useState(false)
  const [lastOrder, setLastOrderState] = useState<LastOrder | null>(() => readLastOrder())

  /**
   * Records the order just placed and mirrors it to `sessionStorage`, so the
   * confirmation page still has it after a reload.
   *
   * Clearing (passing `null`) also clears storage, which is what keeps a stale
   * order from reappearing on a later visit to `/order-complete`.
   */
  const setLastOrder = useCallback((order: LastOrder | null) => {
    setLastOrderState(order)

    if (order) {
      saveLastOrder(order)
      return
    }

    clearLastOrder()
  }, [])

  const refreshCart = useCallback(async () => {
    // Inside the async call, not the synchronous effect body that triggers it,
    // which React flags as a cascading render.
    setIsCartLoading(true)
    try {
      const response = await cartApi.getCart()
      applyCartResponse(setCartItems, setCartSummary, response)
    } finally {
      setIsCartLoading(false)
    }
  }, [])

  /**
   * Some mutations (e.g. order Buy Again) already return the updated cart, and
   * they may carry a new `X-Cart-Id`. Applying that response directly keeps the
   * UI on the cart the server just minted instead of re-fetching by stale id.
   */
  const applyCart = useCallback(
    (response: Awaited<ReturnType<typeof cartApi.getCart>>) => {
      applyCartResponse(setCartItems, setCartSummary, response)
    },
    [],
  )

  const refreshWishlist = useCallback(async () => {
    if (!authUser) {
      setWishlistProducts([])
      return
    }

    setIsWishlistLoading(true)
    try {
      const response = await wishlistApi.getWishlist()
      setWishlistProducts(response.items.map(mapApiProduct))
    } finally {
      setIsWishlistLoading(false)
    }
  }, [authUser])

  useEffect(() => {
    void refreshCart()
  }, [refreshCart])

  useEffect(() => {
    void refreshWishlist()
  }, [refreshWishlist])

  const cartItemCount = useMemo(
    () => cartItems.reduce((total, item) => total + item.quantity, 0),
    [cartItems],
  )

  const addToCart = useCallback(async (product: Product, quantity = 1, variantId?: string) => {
    try {
      const response = await cartApi.addCartItem(product.id, quantity, variantId)
      applyCartResponse(setCartItems, setCartSummary, response)
    } catch (error) {
      // `insufficient_stock` and `currency_mismatch` arrive as 422 with a
      // shopper-readable reason, so they are surfaced instead of swallowed.
      const message = getCartErrorMessage(error)
      if (message) setCartError(message)
      throw error
    }
  }, [])

  /**
   * Finds the cart line already holding this product, so callers can update it
   * instead of adding another line for the same product. `productRid` is the
   * reliable link; the line id is used as a fallback because some responses
   * carry no `productRid`.
   */
  const findCartItemForProduct = useCallback(
    (product: Product, variantId?: string) =>
      cartItems.find((item) => {
        if (item.productRid !== product.id && item.id !== product.id) {
          return false
        }
        if (variantId) {
          return item.variantRid === variantId
        }
        return true
      }),
    [cartItems],
  )

  const updateCartItem = useCallback(
    async (itemId: string, patch: { quantity?: number; selected?: boolean }) => {
      try {
        const response = await cartApi.updateCartItem(itemId, patch)
        applyCartResponse(setCartItems, setCartSummary, response)
      } catch (error) {
        // A rejected quantity leaves the cart untouched server-side, so the
        // authoritative list is re-read to correct the stepper the user just
        // pressed, and the reason is surfaced rather than silently ignored.
        const message = getCartErrorMessage(error)
        if (message) setCartError(message)
        await refreshCart()
        throw error
      }
    },
    [refreshCart],
  )

  const removeCartItem = useCallback(async (itemId: string) => {
    const response = await cartApi.removeCartItem(itemId)
    applyCartResponse(setCartItems, setCartSummary, response)
  }, [])

  const removeSelectedCartItems = useCallback(async () => {
    const response = await cartApi.removeSelectedCartItems()
    applyCartResponse(setCartItems, setCartSummary, response)
  }, [])

  const selectAllCartItems = useCallback(async (selected: boolean) => {
    const response = await cartApi.selectAllCartItems(selected)
    applyCartResponse(setCartItems, setCartSummary, response)
  }, [])

  const moveSelectedToWishlist = useCallback(async () => {
    const response = await cartApi.moveSelectedToWishlist()
    applyCartResponse(setCartItems, setCartSummary, response)
    await refreshWishlist()
  }, [refreshWishlist])

  const isLiked = useCallback(
    (productId: string) => wishlistProducts.some((product) => product.id === productId),
    [wishlistProducts],
  )

  const removeFromWishlist = useCallback(async (product: Product) => {
    await wishlistApi.removeFromWishlist(product.id)
    const productKey = getProductKey(product)
    setWishlistProducts((current) =>
      current.filter((entry) => getProductKey(entry) !== productKey),
    )
  }, [])

  const toggleWishlist = useCallback(
    async (product: Product) => {
      if (!authUser) {
        // Wishlist is auth-gated on the backend. Prompt to sign in rather than
        // silently doing nothing, which looked like a broken heart button.
        requestSignIn()
        return
      }

      if (isLiked(product.id)) {
        await removeFromWishlist(product)
        return
      }

      await wishlistApi.addToWishlist(product.id)
      setWishlistProducts((current) => [...current, { ...product, liked: true }])
    },
    [authUser, isLiked, removeFromWishlist, requestSignIn],
  )

  const clearCartError = useCallback(() => {
    setCartError(null)
  }, [])

  const clearCart = useCallback(() => {
    setCartItems([])
    setCartSummary(null)
  }, [])

  const value = useMemo(
    () => ({
      cartItems,
      cartItemCount,
      cartSummary,
      isCartLoading,
      cartError,
      clearCartError,
      refreshCart,
      applyCartResponse: applyCart,
      addToCart,
      findCartItemForProduct,
      updateCartItem,
      removeCartItem,
      removeSelectedCartItems,
      selectAllCartItems,
      moveSelectedToWishlist,
      wishlistProducts,
      isWishlistLoading,
      refreshWishlist,
      isLiked,
      toggleWishlist,
      removeFromWishlist,
      clearCart,
      lastOrder,
      setLastOrder,
    }),
    [
      addToCart,
      applyCart,
      findCartItemForProduct,
      cartItemCount,
      cartItems,
      cartSummary,
      clearCart,
      cartError,
      clearCartError,
      isCartLoading,
      isLiked,
      isWishlistLoading,
      lastOrder,
      moveSelectedToWishlist,
      refreshCart,
      refreshWishlist,
      removeCartItem,
      removeFromWishlist,
      removeSelectedCartItems,
      selectAllCartItems,
      setLastOrder,
      toggleWishlist,
      updateCartItem,
      wishlistProducts,
    ],
  )

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>
}

export function useShop() {
  const context = useContext(ShopContext)
  if (!context) {
    throw new Error('useShop must be used within ShopProvider')
  }
  return context
}
