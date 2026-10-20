import type { AuthUser } from '../data/auth'
import type { CartItem } from '../data/cart'
import type { PrivacyPolicyBlock } from '../data/privacyPolicy'
import type { Product } from '../data/products'

export type Rid = string

export type Money = {
  amount: number
  currency: string
}

export type ApiErrorBody = {
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  message?: string
  errors?: Record<string, string[]>
}

export type ApiUser = AuthUser & { rid?: Rid }

export type { AuthUser }

export type AuthResponse = {
  user: ApiUser
  accessToken: string
  refreshToken: string
}

export type CheckEmailResponse = {
  exists: boolean
  /**
   * `oauth` is returned for Google-only accounts, which have no password. The
   * client must offer "Continue with Google" instead of a password field for
   * those; see docs/GOOGLE-OAUTH.md.
   */
  nextStep: 'password' | 'register' | 'oauth'
  /** Provider that owns the account when `nextStep` is `oauth`. */
  oauthProvider?: 'google'
}

/** Response of `GET /auth/oauth/google/url`. */
export type GoogleOAuthUrlResponse = {
  url: string
  /** CSRF token. Valid for 10 minutes and single-use; keep it in sessionStorage. */
  state: string
}

/** A delivery promise for a product, replacing the old `delivery` string. */
export type ApiDeliveryQuote = {
  free: boolean
  fee: Money
  minDays: number
  maxDays: number
}

/** Inclusive day range for a delivery estimate, replacing `deliveryEstimate`. */
export type ApiDeliveryDays = {
  min: number
  max: number
}

/** One line of a tax breakdown returned on cart and order payloads. */
export type ApiTaxLine = {
  name: string
  amount: Money
}

/**
 * Money fields the API sends alongside every display string. Per
 * docs/backend-docs/CLIENT-CHANGE-NOTES.md the display strings are deprecated,
 * so these are what the client should read.
 */
export type ApiProductCard = Product & {
  rid?: Rid
  priceMoney?: Money
  originalPriceMoney?: Money | null
  brand?: string
  color?: string
  screenSize?: string | null
  /** Positive percentage, e.g. `18` for 18% off. Replaces `discount`. */
  discountPercent?: number | null
  /** Numeric rating, e.g. `4.6`. Replaces the `rating` string. */
  ratingValue?: number | null
  /** Full delivery promise. Replaces the `delivery` string. */
  deliveryQuote?: ApiDeliveryQuote | null
  /** Tax-inclusive price, present only when the destination country is known. */
  priceInclTaxMoney?: Money | null
  /** Effective tax rate for this price, e.g. `20` for 20%. */
  taxRatePercent?: number | null
  reviewCount?: number
  soldCount?: number
  /** False when the default variant cannot currently be bought. */
  inStock?: boolean
  /**
   * Every attribute with its display name, in category order. Rendered as
   * `label: value` directly; `key` is what the attribute filters use.
   */
  attributes?: ApiProductAttribute[]
}

/** One attribute on a product, ready to display. */
export type ApiProductAttribute = {
  /** Stable identifier, and the key filters use (`?attributes[material]=...`). */
  key: string
  /** Display name, which staff can rename without an API change. */
  label: string
  value: string
}

/** Facet values the listing page renders as filter options. */
/** Facet values for the filter panel. Normalize the wire shape with
 * `mapApiProductFacets`, which guarantees every key is an array. */
export type ProductFacets = {
  brands: string[]
  colors: string[]
  screenSizes: string[]
  /**
   * Delivery filter options, derived from `facets.delivery`. Empty when the
   * request carried no destination, because the API only computes delivery
   * facets for a known one.
   */
  deliveryOptions: string[]
  /** How many products in the current result set have free delivery. */
  freeDeliveryCount: number
}

/**
 * The delivery facet as the API sends it. This is a summary of the result set,
 * not a list of filter values: it reports how many products ship free and which
 * maximum delivery day counts occur, so the client builds its own options.
 *
 * `deliveryDays` is the wire field name, and each entry is the *upper* bound of a
 * delivery window present in the listing. It is deliberately not called
 * `maxDays` — that name belongs to `DeliveryQuote.maxDays`, a per-product
 * window, and conflating the two is what previously emptied this list.
 */
export type ApiDeliveryFacet = {
  freeCount: number
  deliveryDays: number[]
}

/** The facets object as the API actually sends it. */
export type ApiProductFacets = {
  brands?: string[]
  colors?: string[]
  screenSizes?: string[]
  /** Null when the request had no known destination country. */
  delivery?: ApiDeliveryFacet | null
  attributes?: Record<string, string[]>
  attributeLabels?: Record<string, string>
}

export type PaginatedProductsResponse = {
  items: ApiProductCard[]
  total: number
  page?: number
  limit?: number
  /** Raw wire shape; normalize with `mapApiProductFacets` before use. */
  facets?: ApiProductFacets
}

export type ApiProductGalleryImage = {
  rid: Rid | null
  imageUrl: string
  variantRid: Rid | null
}

export type ApiProductOptionGroup = {
  key: string
  label: string
  values: string[]
}

export type ApiProductVariant = {
  rid: Rid
  name: string
  sku: string
  priceMoney: Money
  isDefault: boolean
  /** Per-variant option values, null when the product has no such axis. */
  size?: string | null
  color?: string | null
  inStock?: boolean
  /** Null when the variant is made to order and therefore never sells out. */
  stockQuantity?: number | null
  /** Extra handling time before dispatch, in business days. */
  handlingDays?: number | null
  /** Per-variant delivery quote, which differs from the product's. */
  deliveryQuote?: ApiDeliveryQuote | null
  /** Index in `gallery` for this variant's primary photo. */
  imageIndex?: number | null
}

/** A selectable option axis (e.g. size or colour) shown on the detail page. */
export type ApiVariantOption = {
  rid: Rid
  name: string
  size?: string | null
  color?: string | null
}

export type ApiProductDetailResponse = {
  product: ApiProductCard
  images: string[]
  /** Every image path, in order. Preferred over the fixed-length `images`. */
  imageUrls?: string[]
  gallery?: ApiProductGalleryImage[]
  optionGroups?: ApiProductOptionGroup[]
  ratingValue: number
  reviewCount: number
  soldCount: number
  priceMoney: Money
  shippingFeeMoney?: Money | null
  deliveryDays?: ApiDeliveryDays | null
  modelOptions: string[]
  variants?: ApiProductVariant[]
  /** Replaces `modelOptions` when present; same shape as `variants`. */
  variantOptions?: ApiVariantOption[]
  descriptionLines?: string[]
}

export type ApiProductReview = {
  author: string
  location: string
  /** ISO timestamp. Replaces the `date` display string. */
  createdAt?: string
  /** @deprecated Server-formatted date. Only read while `createdAt` is absent. */
  date?: string
  rating: number
  text: string
  /** Reviewed price. Replaces `priceAmount`. */
  priceMoney?: Money
}

export type ApiCartItem = CartItem & {
  rid?: Rid
  productRid?: Rid
  /** Per-unit price. Replaces the deprecated numeric `price`. */
  priceMoney?: Money
  /** Present when the unit price changed (e.g. after a promotion). */
  previousPrice?: Money
  variantRid?: Rid
  sku?: string
  /** Null when the variant is made to order and therefore never sells out. */
  stockQuantity?: number | null
  /** False when the default variant cannot currently be bought. */
  available?: boolean
}

export type CartSummary = {
  itemsTotal: Money
  itemsDiscount: Money
  subtotal: Money
  shipping: Money
  total: Money
  /** Tax charged. Prices elsewhere are tax-exclusive unless stated. */
  tax?: Money
  /** Itemised tax lines (e.g. VAT + NHIL + GETFund). */
  taxes?: ApiTaxLine[]
  /** Whether `total` already includes `tax`. */
  totalIncludesTax?: boolean
}

export type CartResponse = {
  items: ApiCartItem[]
  summary: CartSummary
}

/**
 * Category tree node. The API nests child nodes under `children`; `subcategories`
 * is accepted as an alias because some endpoints (e.g. the modal panel) used it
 * before the tree shape landed. Treat both via `getApiChildNodes`.
 *
 * `slug` is the wire field and the value used everywhere as the category id
 * (link bar, `categoryId` query param, `getApiChildNodes` lookups). `id` is kept
 * as an optional alias so a deployment that sends `id` still works.
 */
export type ApiCategoryNode = {
  slug?: string
  id?: string
  rid: Rid
  label: string
  image: string | null
  imageUrl?: string | null
  parent?: string | null
  children?: ApiCategoryNode[]
  subcategories?: ApiCategoryNode[]
}

export type ApiCategory = ApiCategoryNode

export type ApiSubcategory = ApiCategoryNode

export type CategoriesResponse = {
  categories: ApiCategory[]
}

/**
 * One panel section. `children` carries the real category nodes, which is what
 * the modal renders; `rid` is present on older payloads that only sent labels.
 */
export type CategoryPanelSection = {
  title: string
  children?: ApiCategoryNode[]
  items?: Array<{ label: string; image: string; rid?: Rid }>
}

/**
 * `GET /categories/:categoryId/panel` returns the resolved category node with a
 * `sections` array attached, so the category itself is carried alongside the
 * panel rather than in a separate key.
 */
export type CategoryPanelResponse = ApiCategoryNode & {
  sections: CategoryPanelSection[]
}

export type CheckoutPreviewResponse = {
  items: ApiCartItem[]
  address?: {
    rid?: Rid
    contact: string
    line1: string
    line2: string
  }
  defaultAddressRid?: Rid
  shipping?: {
    /** Replaces the deprecated `fee` string. */
    feeMoney?: Money
    /** Replaces the deprecated `deliveryWindow` string. */
    deliveryDays?: ApiDeliveryDays
    courierLabel: string
  }
  paymentMethods?: ApiCheckoutPaymentMethod[]
  summary?: CartSummary
}

/**
 * A checkout payment option as the backend now returns it, sourced from admin
 * settings rather than a fixed client list.
 *
 * `icon` is either a short artwork key (`card`, `apple_pay`, `tabby`, ...) or an
 * uploaded path/URL; `iconUrl` is only set for the path/URL case. A bare key is
 * never turned into a URL — see `resolvePaymentMethodArtwork`.
 */
export type ApiCheckoutPaymentMethod = {
  id?: string
  rid?: Rid
  code?: string
  label: string
  icon?: string
  iconUrl?: string
}

/**
 * `GET /payment-methods/checkout`. Reachable without a cart and without auth,
 * for when the method list is needed before a checkout session exists.
 */
export type CheckoutPaymentMethodsResponse = {
  paymentMethods?: ApiCheckoutPaymentMethod[]
  items?: ApiCheckoutPaymentMethod[]
  currencies?: string[]
  countries?: string[]
}

export type PaymentIntentResponse = {
  checkoutUrl: string
  paymentRid: Rid
  provider: string
  orderId: Rid
  amount: Money
  /** Echoes the method that was actually opened, as the backend resolved it. */
  paymentMethodId?: string
}

/** Payment lifecycle states reported by `GET /payments/:paymentId`. */
export type PaymentStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'refunded'

export type PaymentStatusResponse = {
  rid: Rid
  provider: string
  status: PaymentStatus | string
  amount?: {
    amount: number
    currency: string
  }
  /** Null until the order has been placed against this payment. */
  orderId?: Rid | null
}

/**
 * Result of `POST /orders` (order-first checkout).
 *
 * The order exists and holds stock at this point but is unpaid. Payment is
 * opened afterwards via `POST /checkout/payment-intent`, which takes this
 * `orderId`.
 */
export type PlaceOrderResponse = {
  orderId: Rid
  orderReference: string
  /** Frozen delivery wording. Null when no window was recorded for the order. */
  estimatedDelivery: string | null
  status: ApiOrderStatus
  paymentStatus: ApiOrderPaymentStatus
  /** Order total frozen at placement, already including tax. */
  totalMoney: Money
}

/** Order lifecycle. `pending_payment` and `cancelled` replaced `pending`/`failed`. */
export type ApiOrderStatus =
  | 'pending_payment'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'

/** Payment lifecycle, tracked separately from the order status. */
export type ApiOrderPaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded'

/**
 * A line whose price moved since the shopper added it.
 *
 * Sent with the `409 price_changed` conflict so the shopper can review the new
 * price before the order is placed again.
 */
export type PriceChangedItem = {
  cartItemId: Rid
  previousPrice: Money
  price: Money
}

/**
 * Order-time conflicts. All are `409`, and all mean the order was **not** created,
 * so the cart is untouched and the shopper can retry after reviewing.
 *
 * `price_changed` is the expected one on a normal browse-then-checkout: the
 * conflict records that the shopper has now seen the new price, so retrying
 * with a fresh idempotency key succeeds.
 */
export const ORDER_CONFLICT_CODES = [
  'price_changed',
  'item_unavailable',
  'insufficient_stock',
  'currency_mismatch',
  'cart_changed',
] as const

export type OrderConflictCode = (typeof ORDER_CONFLICT_CODES)[number]

/** Cart mutations reject with this when the quantity exceeds available stock. */
export const INSUFFICIENT_STOCK = 'insufficient_stock'

/** A product in a different currency than the cart cannot be added. */
export const CURRENCY_MISMATCH = 'currency_mismatch'

export type ApiOrderRecord = {
  id: Rid
  rid?: Rid
  status: ApiOrderStatus
  /** Tracked separately from `status` since order-first checkout. */
  paymentStatus?: ApiOrderPaymentStatus
  /** ISO timestamp of the current status. Replaces `statusDateLabel`. */
  statusDate?: string
  /** ISO timestamp of when the order was placed. Replaces `orderTime`. */
  placedAt?: string
  itemCount: number
  /** Order total including tax. Replaces the `total` display string. */
  totalMoney?: Money
  productImages: string[]
}

export type OrdersListResponse = {
  orders: ApiOrderRecord[]
  total: number
}

/** A single product line on an order, as returned by `GET /orders/:rid`. */
export type ApiOrderItem = {
  id: Rid
  rid?: Rid
  /** Product this line refers to; the key used to re-add it to the cart. */
  productRid?: Rid
  name: string
  image?: string
  imageUrl?: string
  variant?: string
  quantity: number
  reviewed?: boolean
  unitPrice: Money
}

/** One delivery event on the tracking timeline. */
export type ApiTrackingEvent = {
  id: Rid
  rid?: Rid
  label: string
  description: string
  /** ISO timestamp for when the event occurred. */
  occurredAt: string
}

export type ApiOrderAddress = {
  /**
   * The snapshot may arrive pre-rendered by the backend, which documents it as
   * "contact, line1, line2, country, countryCode, names, phone". When present
   * these are used as-is; otherwise the block is composed from the parts below.
   */
  contact?: string | null
  line1?: string | null
  line2?: string | null
  countryCode?: string | null
  firstName?: string
  lastName?: string
  phoneCountryCode?: string
  phoneNumber?: string
  addressLine?: string
  cityLine?: string
  city?: string
  region?: string
  country?: string
}

/** Whether and until when an order can still be returned. */
export type ApiReturnEligibility = {
  eligible: boolean
  /** Why it is not eligible; only meaningful when `eligible` is false. */
  reason?: string | null
  windowDays?: number
  /** ISO timestamp after which a return is no longer accepted. */
  deadline?: string | null
}

export type ApiOrderDetail = {
  id: Rid
  rid?: Rid
  orderId?: Rid
  orderReference?: string
  status: ApiOrderRecord['status']
  statusDate?: string
  placedAt?: string
  itemCount: number
  totalMoney?: Money
  currency?: string
  /**
   * Frozen delivery wording. Null for an order with no recorded window. The API
   * requires it be displayed as-is and never parsed.
   */
  estimatedDelivery?: string | null
  paymentMethod?: string
  items: ApiOrderItem[]
  productImages?: string[]
  tracking?: ApiTrackingEvent[]
  returns?: { rid?: Rid; id?: Rid; status?: string; reason?: string; createdAt?: string }[]
  address?: ApiOrderAddress
  shipping?: { method?: string; label?: string; feeMinor?: number }
  totals?: {
    itemsTotal: Money
    itemsDiscount: Money
    shipping: Money
    /** Tax charged on the order. */
    tax?: Money
    /** Itemised tax lines. */
    taxes?: ApiTaxLine[]
    /** Order total; includes tax. */
    total: Money
    totalIncludesTax?: boolean
  }
  /** Whether this order can still be returned, and until when. */
  returnEligibility?: ApiReturnEligibility
}

/** `GET /orders/:rid/tracking` wraps its events; the order detail nests them. */
export type OrderTrackingResponse = {
  events: ApiTrackingEvent[]
}

/** `GET /orders/buy-again` returns `products`, not the paged `items` shape. */
export type BuyAgainProductsResponse = {
  products: ApiProductCard[]
}

export type CmsPageResponse = {
  rid?: Rid
  slug: string
  title: string
  lastUpdated: string
  intro: string[]
  blocks: PrivacyPolicyBlock[]
}

/** A single typeahead hit. Product suggestions carry a rid so the row can link
 * straight to the product page. */
export type ApiSearchSuggestion = {
  rid?: Rid
  name: string
  image?: string
  imageUrl?: string
}

export type SearchSuggestionsResponse = {
  suggestions: ApiSearchSuggestion[]
}

/* -------------------------------------------------------------------------- */
/* Account & profile                                                          */
/* -------------------------------------------------------------------------- */

/** `GET /users/me/profile` returns the profile and the default address preview. */
export type ApiProfile = {
  fullName: string
  displayName?: string
  email?: string
  /** The API may echo the avatar initials directly. */
  initials?: string
  /** Returned as `null` until the account sets one. */
  phone?: string | null
  rid?: Rid
  /** ISO country code for catalog pricing when no default address applies. */
  preferredCountry?: string | null
}

export type ApiDefaultAddress = {
  contactName?: string
  firstName?: string
  lastName?: string
  phone?: string
  phoneCountryCode?: string
  phoneNumber?: string
  line1?: string
  line2?: string
  /** ISO 3166-1 alpha-2 country code, used as the catalog destination. */
  country?: string
}

export type ProfileResponse = {
  profile: ApiProfile
  defaultAddress?: ApiDefaultAddress
}

/** `PUT /users/me/country` — catalog destination when no default address applies. */
export type PreferredCountryResponse = {
  /** ISO code, rid, or name as stored by the API. `null` clears the preference. */
  preferredCountry: string | null
}

/** Addresses are returned as `items` (or a bare array on some deployments). */
export type ApiAddress = {
  id?: Rid
  rid?: Rid
  country?: string
  firstName?: string
  lastName?: string
  phoneCountryCode?: string
  phoneNumber?: string
  addressLine?: string
  region?: string
  city?: string
  cityLine?: string
  isDefault?: boolean
}

export type AddressesResponse = {
  items?: ApiAddress[]
  addresses?: ApiAddress[]
}

export type ApiPaymentMethod = {
  id?: Rid
  rid?: Rid
  type?: string
  network?: string
  cardholderName?: string
  maskedDetail?: string
  isDefault?: boolean
}

export type PaymentMethodsResponse = {
  items?: ApiPaymentMethod[]
  paymentMethods?: ApiPaymentMethod[]
}

/**
 * A pending review slot from `GET /reviews/waiting`, or a past review from
 * `GET /reviews/reviewed`. The list endpoints may wrap the rows under `items`
 * or `reviews`.
 */
export type ApiReviewSlot = {
  id?: Rid
  rid?: Rid
  productName?: string
  productImage?: string
  productImageUrl?: string
  orderId?: string
  orderReference?: string
  /** ISO timestamp. Replaces the `deliveredOn` display string. */
  deliveredAt?: string
  /** @deprecated Server-formatted delivery date. Only read while `deliveredAt`
   * is absent. */
  deliveredOn?: string
  priceMoney?: Money
  /** @deprecated Server-formatted price. Only read while `priceMoney` is
   * absent. */
  priceAmount?: number
  /** @deprecated Server-formatted currency. Only read while `priceMoney` is
   * absent. */
  priceCurrency?: string
  quantity?: number
  rating?: number
  title?: string
  detailedReview?: string
  /** ISO timestamp for an already-submitted review. */
  createdAt?: string
  /** @deprecated Server-formatted date. Only read while `createdAt` is absent. */
  date?: string
  /** Moderation state. A new review starts `pending` and appears on the
   * product only once staff approve it. */
  status?: 'pending' | 'published' | string
}

/**
 * Response to `POST /reviews`.
 *
 * The review is created as pending, so the shopper is told it is awaiting
 * approval rather than being shown as if it were already live.
 */
export type SubmitReviewResponse = {
  rid?: Rid
  status?: 'pending' | 'published' | string
}

export type ReviewsResponse = {
  items?: ApiReviewSlot[]
  reviews?: ApiReviewSlot[]
}

export type ApiBrowsingHistoryItem = {
  id?: Rid
  rid?: Rid
  productRid?: Rid
  /**
   * The full product card, nested on the item. This is what the endpoint
   * actually sends, and it carries the price, rating, category and delivery a
   * card needs, so it is mapped rather than reconstructed from the sparse
   * sibling fields.
   */
  product?: ApiProductCard
  name?: string
  image?: string
  imageUrl?: string
  viewedAt?: string
  section?: string
  sectionLabel?: string
}

export type BrowsingHistoryResponse = {
  sections?: Array<{
    id?: string
    rid?: Rid
    label?: string
    items?: ApiBrowsingHistoryItem[]
  }>
  items?: ApiBrowsingHistoryItem[]
}

export type ApiNotificationSetting = {
  id?: string
  rid?: Rid
  title?: string
  description?: string
  enabled?: boolean
}

export type NotificationSettingsResponse = {
  settings?: ApiNotificationSetting[]
}
