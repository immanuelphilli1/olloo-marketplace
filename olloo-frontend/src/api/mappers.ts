import type { SidebarCategoryId } from '../data/categoriesModal'
import type { CartItem } from '../data/cart'
import type { AddressRecord } from '../data/addresses'
import type { BrowsingHistorySection } from '../data/browsingHistory'
import { defaultNotificationSettings } from '../data/notifications'
import type { NotificationSetting, NotificationSettingId } from '../data/notifications'
import { getProfileInitials } from '../data/profile'
import type { DefaultAddress, UserProfile } from '../data/profile'
import type { PaymentMethodRecord, PaymentMethodType } from '../data/paymentMethods'
import type { ReviewedReviewRecord, WaitingReviewRecord } from '../data/reviews'
import type { OrderLine, OrderRecord, OrderStatus, OrderTrackingEvent } from '../data/orders'
import type { Product, ProductAttribute } from '../data/products'
import type { ProductDetail, ProductDetailContext, ProductReview } from '../data/productDetail'
import type { CategoryListingSelection } from '../data/categoryListing'
import {
  ALL_PRODUCTS_LABEL,
  findCategoryInTree,
  getCategoryNodeId,
  getSubcategoryOptions,
  resolveProductListingSelection,
} from '../data/catalogCategories'
import { DELIVERY_OPTION_FREE, getDeliveryOptionByMaxDays } from '../data/deliveryFilter'
import {
  formatAmount,
  formatAmountDecimal,
  formatDeliveryDays,
  formatDiscountPercent,
  formatIsoDate,
} from '../data/format'
import { getApiOrigin } from './config'
import type {
  AddressesResponse,
  ApiAddress,
  ApiBrowsingHistoryItem,
  ApiCartItem,
  ApiCategory,
  ApiDefaultAddress,
  ApiDeliveryFacet,
  ApiDeliveryQuote,
  ApiNotificationSetting,
  ApiOrderAddress,
  ApiOrderDetail,
  ApiOrderRecord,
  ApiPaymentMethod,
  ApiProductAttribute,
  ApiProductCard,
  ApiProductDetailResponse,
  ApiProductFacets,
  ApiProductReview,
  ApiProfile,
  ApiReviewSlot,
  BrowsingHistoryResponse,
  CartSummary,
  Money,
  NotificationSettingsResponse,
  OrderTrackingResponse,
  PaymentMethodsResponse,
  ProductFacets,
  ReviewsResponse,
} from './types'

export function resolveAssetUrl(path: string | undefined): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const origin = getApiOrigin()
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`
}

export function formatMoney(money: Money): string {
  return formatAmount(money)
}

/** A facets value with no selectable options, used before/without API data. */
export const emptyFacets: ProductFacets = {
  brands: [],
  colors: [],
  screenSizes: [],
  deliveryOptions: [],
  freeDeliveryCount: 0,
}

function toFacetList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

/**
 * Builds the delivery filter options from the API's delivery facet.
 *
 * The facet is a summary rather than a list of choices: it reports how many
 * products in the result set ship free (`freeCount`), and which maximum delivery
 * day counts occur (`deliveryDays`). The options are therefore reconstructed
 * here — "Free delivery" when any product is free, plus one option per distinct
 * maximum window ("Within 4 days", "Within 6 days"), ascending. An empty option
 * list means the request had no known destination, so the caller hides the
 * section.
 */
function buildDeliveryOptions(
  delivery: ApiDeliveryFacet | null | undefined,
): { options: string[]; freeCount: number } {
  if (!delivery) return { options: [], freeCount: 0 }

  const options: string[] = []
  if (delivery.freeCount > 0) {
    options.push(DELIVERY_OPTION_FREE)
  }

  // The wire field is `deliveryDays`; the local name keeps the per-entry meaning
  // (an upper bound) visible at the point of use.
  const maxDays = [...new Set(delivery.deliveryDays ?? [])].sort((a, b) => a - b)
  for (const days of maxDays) {
    options.push(getDeliveryOptionByMaxDays(days))
  }

  return { options, freeCount: delivery.freeCount ?? 0 }
}

/** Reads the leading number out of a legacy display string such as `"4.6"`. */
function parseLeadingNumber(value: string | undefined): number | undefined {
  if (!value) return undefined

  const parsed = Number.parseFloat(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

/**
 * Renders a delivery promise as the short label the product cards show. Free
 * delivery is reported as "Free delivery" rather than a fee of zero, because a
 * `AED 0.00` fee reads like a bug. Returns '' when the API sent no quote, so
 * callers can fall back to the deprecated string.
 */
function formatDeliveryQuote(deliveryQuote: ApiDeliveryQuote | null | undefined): string {
  if (!deliveryQuote) return ''

  const days = formatDeliveryDays({
    min: deliveryQuote.minDays,
    max: deliveryQuote.maxDays,
  })
  const window = days ? ` in ${days}` : ''

  return deliveryQuote.free ? `Free delivery${window}` : `Delivery${window}`
}

/**
 * Normalizes the API's facets payload into the shape the filter panel expects.
 *
 * The wire format does not match `ProductFacets`: brand, colour and screen-size
 * values are duplicated under a nested `attributes` object, and `delivery` is a
 * summary (`{ freeCount, deliveryDays }`) rather than a list of options — it is
 * null entirely unless the request carried a destination country. Every key is
 * guaranteed to be present, so consumers can read `.length` without guarding.
 */
export function mapApiProductFacets(facets: ApiProductFacets | undefined): ProductFacets {
  const attributes = facets?.attributes ?? {}
  const delivery = buildDeliveryOptions(facets?.delivery)

  return {
    brands: toFacetList(facets?.brands ?? attributes.brand),
    colors: toFacetList(facets?.colors ?? attributes.color),
    screenSizes: toFacetList(facets?.screenSizes ?? attributes.screenSize),
    deliveryOptions: delivery.options,
    freeDeliveryCount: delivery.freeCount,
  }
}

export function mapApiProduct(product: ApiProductCard): Product {
  // The API's display strings are deprecated, so the Money/percent fields are the
  // source of truth and the strings the UI still reads are derived from them.
  const priceMoney = product.priceMoney
  const originalPriceMoney = product.originalPriceMoney ?? undefined
  const price = priceMoney ? formatAmount(priceMoney) : product.price
  const ratingValue = product.ratingValue ?? parseLeadingNumber(product.rating)

  return {
    id: product.rid ?? product.id,
    categoryId: product.categoryId as SidebarCategoryId,
    subcategory: product.subcategory,
    image: resolveAssetUrl(product.image),
    tag: product.tag,
    category: product.category,
    name: product.name,
    price,
    originalPrice: originalPriceMoney ? formatAmount(originalPriceMoney) : product.originalPrice ?? undefined,
    discount: formatDiscountPercent(product.discountPercent) || product.discount || undefined,
    delivery: formatDeliveryQuote(product.deliveryQuote) || product.delivery,
    rating: ratingValue ? String(ratingValue) : product.rating,
    liked: product.liked ?? undefined,
    showAddButton: product.showAddButton,
    priceOrange: product.priceOrange,
    imageObjectPosition: product.imageObjectPosition,
    // Facets power the listing filters, so they are carried onto the domain
    // model rather than being dropped during mapping.
    priceAmount: priceMoney?.amount,
    priceCurrency: priceMoney?.currency,
    brand: product.brand,
    color: product.color,
    screenSize: product.screenSize,
    attributes: mapApiProductAttributes(product.attributes),
    inStock: product.inStock,
  }
}

/**
 * Normalizes the API's `attributes[]` into display-ready pairs.
 *
 * Each entry already carries its display `label`, so it is rendered directly
 * rather than matched against a local copy of the attribute names — staff can
 * rename an attribute in the admin and the new wording appears without a client
 * change. Entries missing a label or value are dropped, since an empty row is
 * worse than no row.
 */
function mapApiProductAttributes(
  attributes: ApiProductAttribute[] | undefined,
): ProductAttribute[] | undefined {
  if (!Array.isArray(attributes)) return undefined

  const mapped = attributes.flatMap((attribute) => {
    if (!attribute?.key || !attribute.label || !attribute.value) return []
    return [{ key: attribute.key, label: attribute.label, value: attribute.value }]
  })

  return mapped.length > 0 ? mapped : undefined
}

export function mapApiCartItem(item: ApiCartItem): CartItem {
  // Cart lines are always priced at today's price. `previousPrice` is present
  // only when the price moved since the shopper added the line, and is what the
  // cart highlights so the shopper notices before `POST /orders` rejects them.
  const priceMoney = item.priceMoney
  const previousPriceMoney = item.previousPrice

  return {
    id: item.rid ?? item.id,
    productRid: item.productRid,
    variantRid: item.variantRid,
    name: item.name,
    variant: item.variant,
    image: resolveAssetUrl(item.image),
    currency: priceMoney?.currency ?? item.currency,
    price: priceMoney?.amount ?? item.price,
    quantity: item.quantity,
    selected: item.selected,
    previousPrice: previousPriceMoney?.amount,
    stockQuantity: item.stockQuantity,
    available: item.available,
  }
}

/**
 * Badge copy per status. The server used to send `statusBadgeLabel`, but wording
 * is now the client's responsibility, so it is derived from the raw status.
 */
const orderStatusBadgeLabels: Record<OrderStatus, string> = {
  // The server's documented wording for an order awaiting payment.
  pending_payment: 'Awaiting payment',
  processing: 'Processing Order',
  shipped: 'Order Shipped',
  delivered: 'Delivered on time',
  cancelled: 'Order cancelled',
}

export function mapApiOrder(order: ApiOrderRecord): OrderRecord {
  const statusDate = formatIsoDate(order.statusDate)

  return {
    id: order.rid ?? order.id,
    status: order.status,
    statusDateLabel: statusDate ? `${getOrderStatusLabel(order.status)} on ${statusDate}` : '',
    statusBadgeLabel: orderStatusBadgeLabels[order.status],
    itemCount: order.itemCount,
    total: formatAmount(order.totalMoney),
    orderTime: formatIsoDate(order.placedAt),
    productImages: order.productImages.map(resolveAssetUrl),
  }
}

/** Human-readable name for an order status, used in the status date line. */
function getOrderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case 'pending_payment':
      return 'Awaiting payment'
    case 'processing':
      return 'Processing'
    case 'shipped':
      return 'Shipped'
    case 'delivered':
      return 'Delivered'
    case 'cancelled':
      return 'Cancelled'
    default: {
      const exhaustiveCheck: never = status
      return exhaustiveCheck
    }
  }
}

/**
 * Order lines from `GET /orders/:rid`. The list endpoint returns only product
 * images, so the lines that drive Buy Again and the tracker come from the
 * detail call and are merged onto the record by id.
 */
export function mapApiOrderLines(order: ApiOrderDetail): OrderLine[] {
  return order.items.map((item) => ({
    productId: item.productRid ?? item.id,
    name: item.name,
    image: resolveAssetUrl(item.imageUrl ?? item.image),
    price: formatMoney(item.unitPrice),
    quantity: item.quantity,
  }))
}

/**
 * Tracking events from `GET /orders/:rid/tracking`, or the copy embedded in the
 * order detail when only that has been fetched. Events arrive oldest-first.
 */
export function mapApiOrderTracking(
  tracking: OrderTrackingResponse | ApiOrderDetail,
): OrderTrackingEvent[] {
  const events = 'events' in tracking ? tracking.events : (tracking.tracking ?? [])

  return events.map((event) => ({
    id: event.rid ?? event.id,
    label: event.label,
    description: event.description,
    occurredAt: event.occurredAt,
  }))
}

function mapApiProductDetailVariants(
  response: ApiProductDetailResponse,
): ProductDetail['variants'] {
  if (response.variants?.length) {
    return response.variants.map((variant) => ({
      rid: variant.rid,
      name: variant.name,
      color: variant.color ?? null,
      size: variant.size ?? null,
      isDefault: variant.isDefault ?? false,
      inStock: variant.inStock ?? true,
      stockQuantity: variant.stockQuantity ?? null,
      priceAmount: formatAmountDecimal(variant.priceMoney.amount),
      priceCurrency: variant.priceMoney.currency,
      imageIndex: variant.imageIndex ?? null,
      delivery: formatDeliveryQuote(variant.deliveryQuote ?? response.product.deliveryQuote),
    }))
  }

  if (response.variantOptions?.length) {
    return response.variantOptions.map((variant, index) => ({
      rid: variant.rid,
      name: variant.name,
      color: variant.color ?? null,
      size: variant.size ?? null,
      isDefault: index === 0,
      inStock: true,
      stockQuantity: null,
      priceAmount: formatAmountDecimal(response.priceMoney.amount),
      priceCurrency: response.priceMoney.currency,
      imageIndex: null,
      delivery: formatDeliveryQuote(response.product.deliveryQuote),
    }))
  }

  return []
}

export function mapApiProductDetail(
  response: ApiProductDetailResponse,
  selection: CategoryListingSelection,
): ProductDetailContext {
  const product = mapApiProduct(response.product)
  const variants = mapApiProductDetailVariants(response)
  const defaultVariant = variants.find((variant) => variant.isDefault) ?? variants[0]
  const priceMoney =
    defaultVariant != null
      ? {
          amount: Number.parseFloat(defaultVariant.priceAmount),
          currency: defaultVariant.priceCurrency,
        }
      : response.priceMoney ?? response.product.priceMoney
  if (!priceMoney) {
    throw new Error('Product detail is missing price information.')
  }
  const priceAmount = formatAmountDecimal(priceMoney.amount)
  const priceCurrency = priceMoney.currency

  const gallery =
    response.gallery?.map((entry) => ({
      rid: entry.rid,
      imageUrl: resolveAssetUrl(entry.imageUrl),
      variantRid: entry.variantRid,
    })) ?? []

  const images =
    gallery.length > 0
      ? gallery.map((entry) => entry.imageUrl)
      : (response.imageUrls ?? response.images).map(resolveAssetUrl)

  const optionGroups =
    response.optionGroups?.map((group) => ({
      key: group.key,
      label: group.label,
      values: group.values,
    })) ?? []

  const shippingFee = formatAmount(response.shippingFeeMoney ?? response.priceMoney)
  const deliveryEstimate =
    defaultVariant?.delivery || formatDeliveryDays(response.deliveryDays)

  const detail: ProductDetail = {
    product,
    images,
    gallery,
    optionGroups,
    variants,
    ratingValue: response.ratingValue,
    reviewCount: response.reviewCount,
    soldCount: response.soldCount,
    priceAmount,
    priceCurrency,
    modelOptions: response.modelOptions ?? variants.map((variant) => variant.name),
    descriptionLines: response.descriptionLines ?? [],
    reviews: [],
    shippingAddress: {
      line1: 'Hse 8 M Street',
      line2: 'Accra Ghana',
    },
    shippingFee,
    deliveryEstimate,
    itemsTotal: `${priceCurrency} ${priceAmount}`,
    subtotal: `${priceCurrency} ${priceAmount}`,
  }

  return { detail, selection }
}

export function buildSelectionForProduct(
  product: Product,
  from?: string | null,
  categoryId?: string | null,
  subcategory?: string | null,
  apiCategories: ApiCategory[] = [],
): CategoryListingSelection {
  if (from === 'wishlist') {
    return {
      categoryId: 'featured',
      categoryLabel: 'Wishlist',
      subcategoryLabel: 'Liked items',
      subcategoryOptions: [],
    }
  }

  if (from === 'featured') {
    return {
      categoryId: 'featured',
      categoryLabel: 'Featured items',
      subcategoryLabel: 'Featured',
      subcategoryOptions: [],
    }
  }

  if (from === 'home') {
    return {
      categoryId: 'featured',
      categoryLabel: 'New Arrivals',
      subcategoryLabel: 'Featured',
      subcategoryOptions: [],
    }
  }

  // Recommendations on the order confirmation page. Its own label, so the
  // product's breadcrumbs point back to the confirmation the shopper came from
  // rather than to an unrelated listing.
  if (from === 'order-complete') {
    return {
      categoryId: 'featured',
      categoryLabel: 'Order Completed',
      subcategoryLabel: 'You may also like',
      subcategoryOptions: [],
    }
  }

  if (categoryId && !subcategory) {
    const treeMatch = findCategoryInTree(apiCategories, categoryId)
    if (treeMatch) {
      const rootId = getCategoryNodeId(treeMatch.root)
      const nodeId = getCategoryNodeId(treeMatch.node)
      const subcategoryOptions = getSubcategoryOptions(rootId, apiCategories)

      if (rootId !== nodeId) {
        return {
          categoryId: rootId,
          categoryLabel: treeMatch.root.label,
          subcategoryLabel: treeMatch.node.label,
          subcategoryOptions,
        }
      }

      return {
        categoryId: rootId,
        categoryLabel: treeMatch.root.label,
        subcategoryLabel: ALL_PRODUCTS_LABEL,
        subcategoryOptions,
      }
    }
  }

  if (categoryId && subcategory) {
    const treeMatch = findCategoryInTree(apiCategories, categoryId)
    if (treeMatch && getCategoryNodeId(treeMatch.root) !== getCategoryNodeId(treeMatch.node)) {
      return resolveProductListingSelection(categoryId, subcategory, apiCategories)
    }

    const topLevel = apiCategories.find((entry) => getCategoryNodeId(entry) === categoryId)
    if (topLevel) {
      return {
        categoryId,
        categoryLabel: topLevel.label,
        subcategoryLabel: subcategory,
        subcategoryOptions: getSubcategoryOptions(categoryId, apiCategories),
      }
    }

    return resolveProductListingSelection(categoryId, subcategory, apiCategories)
  }

  return resolveProductListingSelection(
    product.categoryId,
    product.subcategory,
    apiCategories,
  )
}

export function mapApiProductReview(review: ApiProductReview): ProductReview {
  return {
    author: review.author,
    location: review.location,
    // `createdAt` is ISO; the review card wants a readable short date. The
    // server-formatted `date` is only the fallback while `createdAt` is absent.
    date: formatIsoDate(review.createdAt) || review.date || '',
    rating: review.rating,
    text: review.text,
  }
}

export function mapCartSummaryToDisplay(summary: CartSummary) {
  return {
    itemsTotal: formatAmount(summary.itemsTotal),
    itemsDiscount: formatAmount(summary.itemsDiscount),
    subtotal: formatAmount(summary.subtotal),
    shipping: formatAmount(summary.shipping),
    // Tax is optional: it only appears when the destination country is known.
    tax: summary.tax ? formatAmount(summary.tax) : '',
    total: formatAmount(summary.total),
  }
}

/* -------------------------------------------------------------------------- */
/* Account & profile                                                          */
/* -------------------------------------------------------------------------- */

/** Stable client key for an address; the mutations address it by this rid. */
export function getApiAddressId(address: ApiAddress): string {
  return address.rid ?? address.id ?? ''
}

/**
 * Display names for country codes, so an address saved as `GH` reads as "Ghana"
 * rather than showing the bare ISO code. Countries outside this map fall back to
 * their stored value rather than being blanked out.
 */
const countryCodeNames: Record<string, string> = {
  AE: 'United Arab Emirates',
  GH: 'Ghana',
  US: 'United States',
  GB: 'United Kingdom',
  NG: 'Nigeria',
}

/** Renders a stored country as a name, falling back to the raw value. */
function getCountryDisplayName(country: string): string {
  if (!country) return ''
  return countryCodeNames[country.toUpperCase()] ?? country
}

export function mapApiAddress(address: ApiAddress): AddressRecord {
  const firstName = address.firstName ?? ''
  const lastName = address.lastName ?? ''
  const city = address.city ?? ''
  const region = address.region ?? ''
  const countryCode = address.country ?? ''
  // The card shows a country name; `country` keeps the raw code, which is what
  // the catalog needs as `?country=`.
  const country = getCountryDisplayName(countryCode)

  // The API only guarantees the individual parts, but the cards read a single
  // "city line", so compose one and fall back to whatever is available.
  const composedCityLine = [city, region, country].filter(Boolean).join(', ').trim()
  const cityLine = address.cityLine ?? (composedCityLine || '—')

  return {
    id: getApiAddressId(address),
    country: countryCode,
    countryName: country,
    firstName,
    lastName,
    phoneCountryCode: address.phoneCountryCode ?? '',
    phoneNumber: address.phoneNumber ?? '',
    addressLine: address.addressLine ?? '',
    region,
    city,
    cityLine,
    isDefault: address.isDefault ?? false,
  }
}

/** Addresses may arrive as a bare array, or under `items`/`addresses`. */
export function mapApiAddresses(response: AddressesResponse | ApiAddress[]): AddressRecord[] {
  const source = Array.isArray(response) ? response : (response.items ?? response.addresses ?? [])
  return source.filter((address) => getApiAddressId(address) !== '').map(mapApiAddress)
}

/**
 * The shipping address frozen onto an order, formatted for display.
 *
 * `GET /orders/:rid` returns the address the order will actually ship to, which
 * is the only trustworthy source on a confirmation page: the account's current
 * default address may have been changed, or may never have been set.
 *
 * Every field is optional here, so absent parts are skipped rather than rendered
 * as blank lines or a placeholder. `null` means the order has no address recorded,
 * which the caller reports rather than fakes.
 */
export type OrderAddress = {
  /** Contact name and phone on one line, omitted when neither is known. */
  contact: string
  /** Street line, or an empty string when the order carries none. */
  line1: string
  /** City / region / country line, omitted when the order carries none. */
  line2: string
}

export function mapApiOrderAddress(address: ApiOrderAddress | undefined): OrderAddress | null {
  if (!address) return null

  const contactName = [address.firstName, address.lastName].filter(Boolean).join(' ').trim()
  const phone = [address.phoneCountryCode, address.phoneNumber].filter(Boolean).join(' ').trim()
  const composedContact = [contactName, phone].filter(Boolean).join(' | ').trim()

  const street = address.addressLine?.trim() ?? ''

  // The API may send a precomposed `cityLine`; otherwise it is built from the
  // parts. Country is a code here, so it is rendered as a name for the shopper.
  const composedCityLine = [
    address.city,
    address.region,
    address.country ? getCountryDisplayName(address.country) : '',
  ]
    .filter(Boolean)
    .join(', ')
    .trim()

  return {
    // The backend may render these lines itself (documented as `contact`,
    // `line1`, `line2` on the snapshot), so those win. They are only composed
    // from parts when absent, which keeps the page working against either shape.
    contact: (address.contact ?? composedContact).trim(),
    line1: (address.line1 ?? street).trim(),
    line2: (address.cityLine ?? address.line2 ?? composedCityLine).trim(),
  }
}

export function getApiPaymentMethodId(payment: ApiPaymentMethod): string {
  return payment.rid ?? payment.id ?? ''
}

/** Card/mobile-money network ids are lowercase; the UI's union is not. */
export function mapApiPaymentMethodType(
  type: string | undefined,
  network: string | undefined,
): PaymentMethodType {
  const raw = (type ?? network ?? '').toLowerCase()

  if (raw.includes('paypal')) return 'paypal'
  if (raw.includes('money') || raw.includes('mtn') || raw.includes('vodafone')) {
    return 'mobile_money'
  }
  if (raw.includes('visa') || raw.includes('master') || raw.includes('card')) return 'visa'

  return 'visa'
}

export function mapApiPaymentMethod(payment: ApiPaymentMethod): PaymentMethodRecord {
  return {
    id: getApiPaymentMethodId(payment),
    cardholderName: payment.cardholderName ?? '',
    type: mapApiPaymentMethodType(payment.type, payment.network),
    maskedDetail: payment.maskedDetail ?? '',
    network: payment.network,
    isDefault: payment.isDefault ?? false,
  }
}

export function mapApiPaymentMethods(
  response: PaymentMethodsResponse | ApiPaymentMethod[],
): PaymentMethodRecord[] {
  const source = Array.isArray(response)
    ? response
    : (response.items ?? response.paymentMethods ?? [])
  return source
    .filter((payment) => getApiPaymentMethodId(payment) !== '')
    .map(mapApiPaymentMethod)
}

export function mapApiProfile(profile: ApiProfile): UserProfile {
  const fullName = profile.fullName ?? profile.displayName ?? ''
  return {
    fullName,
    email: profile.email ?? '',
    initials: profile.initials ?? getProfileInitials(fullName),
  }
}

export function mapApiDefaultAddress(address?: ApiDefaultAddress): DefaultAddress {
  const contactName =
    address?.contactName ??
    [address?.firstName, address?.lastName].filter(Boolean).join(' ').trim()

  const phone =
    address?.phone ??
    [address?.phoneCountryCode, address?.phoneNumber].filter(Boolean).join(' ').trim()

  return {
    // The profile's embedded copy is display-only and carries no rid, so this is
    // only usable when no list entry flagged itself default.
    contactName,
    phone,
    line1: address?.line1 ?? '',
    line2: address?.line2 ?? '',
    // Addresses store the ISO code, which is exactly what the catalog needs as
    // `?country=` for delivery quotes and tax.
    countryCode: normalizeCountryCode(address?.country),
  }
}

/**
 * Coerces a stored country into an ISO 3166-1 alpha-2 code.
 *
 * Addresses are supposed to hold the code (`GH`), but a name (`Ghana`) is also
 * accepted defensively so a legacy record still resolves. An unrecognised value
 * returns undefined rather than a guess, and the caller falls back to its
 * default destination.
 */
function normalizeCountryCode(country: string | undefined): string | undefined {
  const value = (country ?? '').trim()
  if (!value) return undefined

  // A bare two-letter value is already the code.
  if (/^[A-Za-z]{2}$/.test(value)) return value.toUpperCase()

  const nameToCode: Record<string, string> = {
    ghana: 'GH',
    'united arab emirates': 'AE',
    uae: 'AE',
    'united states': 'US',
    'united states of america': 'US',
    usa: 'US',
    'united kingdom': 'GB',
    uk: 'GB',
    nigeria: 'NG',
  }

  return nameToCode[value.toLowerCase()]
}

/**
 * Reshapes an entry from the addresses list into the profile's preview shape.
 *
 * The profile shows the account's default address, which is the same record the
 * Addresses tab lists and marks with `isDefault`. `mapApiDefaultAddress` cannot
 * be reused directly because the two endpoints spell their fields differently:
 * the list returns `addressLine` plus `city`/`region`/`country`, while the
 * profile preview expects two composed `line1`/`line2` strings.
 */
export function addressRecordToDefaultPreview(address: AddressRecord): DefaultAddress {
  const contactName = [address.firstName, address.lastName].filter(Boolean).join(' ').trim()
  const phone = [address.phoneCountryCode, address.phoneNumber].filter(Boolean).join(' ').trim()

  const cityParts = [address.city, address.region, address.countryName].filter(Boolean)

  return {
    // `POST /orders` needs the address rid, which lives on the list entry.
    rid: address.id || undefined,
    contactName,
    phone,
    line1: address.addressLine,
    // `cityLine` is already composed as "city, region, country" by the mapper.
    line2: address.cityLine ?? cityParts.join(', '),
    countryCode: normalizeCountryCode(address.country),
  }
}

/**
 * A waiting slot and a reviewed row share the same payload shape, so both start
 * from this. `deliveredAt`, `createdAt` and `priceMoney` are the source of truth;
 * the preformatted `deliveredOn`/`date`/`priceAmount` strings are only read when
 * the raw field is missing, because they are deprecated but still served.
 */
function mapApiReviewSlotBase(slot: ApiReviewSlot): WaitingReviewRecord {
  const priceMoney = slot.priceMoney
  const currency = priceMoney?.currency ?? slot.priceCurrency ?? ''
  const amount =
    priceMoney !== undefined
      ? formatAmountDecimal(priceMoney.amount)
      : typeof slot.priceAmount === 'number'
        ? formatAmountDecimal(slot.priceAmount)
        : ''

  return {
    id: slot.rid ?? slot.id ?? '',
    productName: slot.productName ?? '',
    productImage: resolveAssetUrl(slot.productImageUrl ?? slot.productImage),
    orderId: slot.orderReference ?? slot.orderId ?? '',
    deliveredOn: formatIsoDate(slot.deliveredAt) || slot.deliveredOn || '',
    priceCurrency: currency,
    priceAmount: amount,
    quantity: slot.quantity ?? 1,
  }
}

/** Anything that is not explicitly `published` is treated as still in moderation. */
function mapApiReviewStatus(status: string | undefined): 'pending' | 'published' {
  return status === 'published' ? 'published' : 'pending'
}

/**
 * A row from `GET /reviews/reviewed` is a waiting slot plus the review the
 * shopper submitted, so the tab can show what they wrote and whether it is live
 * yet. `createdAt` is the submission time; the deprecated `date` string is only
 * the fallback.
 */
export function mapApiReviewedReviewSlot(slot: ApiReviewSlot): ReviewedReviewRecord {
  return {
    ...mapApiReviewSlotBase(slot),
    submittedOn: formatIsoDate(slot.createdAt) || slot.date || '',
    status: mapApiReviewStatus(slot.status),
    rating: typeof slot.rating === 'number' ? slot.rating : null,
    title: slot.title ?? '',
    text: slot.detailedReview ?? '',
  }
}

/**
 * `GET /reviews/waiting` and `GET /reviews/reviewed` wrap their rows under
 * `items` or `reviews`; the flow scripts probe both.
 */
export function mapApiReviewSlots(response: ReviewsResponse): WaitingReviewRecord[] {
  const source = response.items ?? response.reviews ?? []
  return source
    .filter((slot) => (slot.rid ?? slot.id ?? '') !== '')
    .map(mapApiReviewSlotBase)
}

/** `GET /reviews/reviewed`, mapped to the richer submitted-review shape. */
export function mapApiReviewedReviewSlots(
  response: ReviewsResponse,
): ReviewedReviewRecord[] {
  const source = response.items ?? response.reviews ?? []
  return source
    .filter((slot) => (slot.rid ?? slot.id ?? '') !== '' || slot.createdAt !== undefined)
    .map(mapApiReviewedReviewSlot)
}

/**
 * A history row nests the whole product card under `product`, so it is mapped
 * with the same function the catalog and listings use. That gives the card its
 * real price, rating, category, delivery and discount instead of a hollow shell.
 *
 * The item-level `name`/`imageUrl` are only a fallback for the older shape
 * where `product` was absent; the sparse fields never override real data.
 */
function mapApiHistoryProduct(item: ApiBrowsingHistoryItem, fallbackId: string): Product {
  if (item.product) {
    return mapApiProduct(item.product)
  }

  // Legacy shape: only a product rid and an image are available, so the card
  // renders what exists rather than inventing a price.
  return {
    id: item.productRid ?? item.rid ?? item.id ?? fallbackId,
    categoryId: 'featured',
    subcategory: '',
    image: resolveAssetUrl(item.imageUrl ?? item.image),
    tag: '',
    category: 'Recently viewed',
    name: item.name ?? '',
    price: '',
    delivery: '',
    rating: '',
  }
}

/**
 * Browsing history arrives either grouped into sections or as a flat list. A
 * flat list is grouped by its `viewedAt` day so the panel keeps its sections.
 */
export function mapApiBrowsingHistory(
  response: BrowsingHistoryResponse,
): BrowsingHistorySection[] {

  if (response.sections) {
    return response.sections
      .map((section) => ({
        id: section.id ?? section.rid ?? section.label ?? '',
        label: section.label ?? 'Recently viewed',
        items: (section.items ?? []).map((item, index) => ({
          id: item.rid ?? item.id ?? `${section.id ?? 'item'}-${index}`,
          product: mapApiHistoryProduct(item, `${section.id ?? 'item'}-${index}`),
        })),
      }))
      .filter((section) => section.items.length > 0)
  }

  const items = response.items ?? []
  if (items.length === 0) return []

  const today = new Date().toISOString().slice(0, 10)
  const grouped = new Map<string, BrowsingHistorySection>()

  for (const [index, item] of items.entries()) {
    const viewedAt = item.viewedAt ?? ''
    const day = viewedAt ? viewedAt.slice(0, 10) : today
    const isToday = day === today
    const label = isToday
      ? 'Today'
      : new Date(day).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })

    const key = isToday ? 'today' : day
    const section = grouped.get(key) ?? { id: key, label, items: [] }

    section.items.push({
      id: item.rid ?? item.id ?? `history-${index}`,
      product: mapApiHistoryProduct(item, `history-${index}`),
    })
    grouped.set(key, section)
  }

  return [...grouped.values()]
}

export function mapApiNotificationSettings(
  response: NotificationSettingsResponse | ApiNotificationSetting[],
): NotificationSetting[] {
  const source = Array.isArray(response) ? response : (response.settings ?? [])
  const defaults = new Map(defaultNotificationSettings.map((item) => [item.id, item]))

  return source.map((setting, index) => {
    const id = (setting.id ?? setting.rid ?? '') as NotificationSettingId
    const fallback = defaults.get(id) ?? defaultNotificationSettings[index % defaultNotificationSettings.length]

    return {
      id: id in defaults ? id : fallback.id,
      title: setting.title ?? fallback.title,
      description: setting.description ?? fallback.description,
      enabled: setting.enabled ?? fallback.enabled,
    }
  })
}

