# HandCO API Specification

Backend API reference for the H&CO ecommerce frontend, kept against the Laravel implementation (`routes/api.php`, `app/Http/Controllers/Api/V1`, `app/Services`).

**Status:** Live implementation. Format all money and dates from the structured fields (`docs/CLIENT-CHANGE-NOTES.md` records what was removed).

---

## Conventions

| Item | Recommendation |
|------|----------------|
| Base URL | `https://api.handco.example/v1` (configure via `VITE_API_BASE_URL`) |
| Format | JSON request/response bodies |
| Auth | `Authorization: Bearer <access_token>` for protected routes |
| Guest cart | `X-Cart-Id` header or `cart_id` cookie for unauthenticated sessions (ignored once authenticated, except `POST /cart/merge` and `POST /orders` which consume the guest rid for merging) |
| Errors | `{ "error": { "code": string, "message": string, "details?": object } }` |
| Pagination | `?page=1&limit=20` → `{ items, total, page, limit }` |
| Money | Prefer structured `{ amount: number, currency: "USD" }` over display strings like `"USD 179.00"` |
| Currency | Amounts come in the shopper's currency (see Currency below); `GET /locale` says which |
| IDs | Every id on the wire is a `rid` string (products, cart lines, addresses, orders); orders also carry a display reference like `#HCO5241124542` |
| Idempotency | `POST /orders` and `POST /checkout/payment-intent` require `Idempotency-Key` |

### Frontend routes that consume these APIs

| Route | Primary API groups |
|-------|-------------------|
| `/` | Home content, featured products, new arrivals |
| `/products/:productId` | Product detail, reviews, related products |
| `/categories`, `/categories/:categoryId` | Product listing, filter facets |
| `/cart` | Cart CRUD, order summary |
| `/checkout` | Checkout preview, shipping quote, payment |
| `/order-complete` | Order confirmation |
| `/wishlist` | Wishlist |
| `/account/:section` | Auth, orders, reviews, profile, addresses, payments, history, notifications |
| `/about`, `/privacy-policy`, etc. | CMS content (optional) |

---

## 1. Authentication

Used by: `SignInModal`, `Nav`, `AccountPage`, all account panels.

### Types (from `src/data/auth.ts`)

```ts
AuthUser = {
  displayName: string
  fullName: string
  email: string
}
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/check-email` | No | Email-first sign-in step |
| `POST` | `/auth/check-phone` | No | Phone-first sign-in step (Ghana mobile numbers) |
| `POST` | `/auth/login` | No | Email or phone + password login |
| `POST` | `/auth/register` | No | Create account after email step |
| `GET` | `/auth/oauth/:provider/url` | No | Google consent URL + `state` (`google` only) |
| `POST` | `/auth/oauth/:provider` | No | Exchange Google `code` + `state` for tokens |
| `POST` | `/auth/logout` | Yes | End session |
| `GET` | `/auth/me` | Yes | Current user |
| `POST` | `/auth/forgot-password` | No | Send reset email |
| `POST` | `/auth/reset-password` | No | Reset with token |
| `POST` | `/auth/refresh` | No | Refresh access token |

#### `POST /auth/check-email`

**Request**
```json
{ "email": "user@example.com" }
```

**Response**
```json
{ "exists": true, "nextStep": "password" }
```

`nextStep` is `register`, `password`, or `oauth`. For `oauth` (account created with Google, no password) the response also has `"oauthProvider": "google"`.

#### `POST /auth/check-phone`

**Request**
```json
{ "phone": "024 123 4567" }
```

**Response**
```json
{ "exists": false, "nextStep": "register", "phone": "+233241234567" }
```

Any common spelling of a Ghana mobile number is accepted (`0241234567`, `+233 24 123 4567`, `233241234567`, `241234567`) and normalised to E.164, returned as `phone`. Landlines and foreign numbers fail with `422 validation_error` ("Enter a valid Ghana mobile number, such as 024 123 4567."). `nextStep` is `register` or `password`.

#### `POST /auth/register`

**Request**
```json
{ "email": "ama@example.com", "password": "••••••••", "password_confirmation": "••••••••", "fullName": "Ama Mensah", "country": "GH" }
```

`phone` (optional) is a Ghana mobile number, normalised as in `check-phone` and stored as the account's sign-in number (`users.login_phone`); a number already on a live account fails with `422 validation_error`. `email` stays required: Paystack needs it for every charge and password reset is by email. `country` (required) is the country of residence as an ISO code from `GET /addresses/lookup/countries`. It becomes the shopper's preferred country, so prices follow that market. `displayName` is optional and defaults to the first word of `fullName`. Errors: `422 validation_error`, `422 country_not_found`. Response: `201`, same shape as login.

#### `POST /auth/login`

**Request**
```json
{ "email": "user@example.com", "password": "••••••••" }
```

or, with a phone number instead of `email`:

```json
{ "phone": "0241234567", "password": "••••••••" }
```

The auth `user` object carries `phone` (E.164, or `null` for email-only accounts).

**Response**
```json
{
  "user": { "displayName": "Vikers", "fullName": "Vikers Junior", "email": "user@example.com" },
  "accessToken": "…",
  "refreshToken": "…"
}
```

#### `GET /auth/oauth/:provider/url`

Only `google` is supported. Returns the Google consent URL and an encrypted `state` (valid 10 minutes). Store `state`, then send the browser to `url`.

```json
{ "url": "https://accounts.google.com/o/oauth2/v2/auth?...", "state": "eyJpdiI6..." }
```

#### `POST /auth/oauth/:provider`

Call from the web client callback page (`GOOGLE_OAUTH_REDIRECT_URL`) with the `code` and `state` Google appended to it.

**Request**
```json
{ "code": "4/0Ab...", "state": "eyJpdiI6..." }
```

**Response**: same shape as login. Errors: `oauth_invalid_state` (422), `oauth_failed` (401), `oauth_email_unverified` (422), `oauth_account_conflict` (409). Full guide: `docs/GOOGLE-OAUTH.md`.

> **Note:** Account routes are not guarded in the UI today. Backend should return `401` for unauthenticated access; frontend should add route guards.

---

## 2. Categories & Catalog

Used by: `CategoriesModal`, `CategoryListingView`, `CategoryGridSection`, `HomePage`, `ProductListingFilters`.

### Types

```ts
SidebarCategoryId =
  | 'all-categories' | 'featured' | 'new-releases' | 'electronics'
  | 'fashion' | 'home-garden' | 'decor' | 'furniture'
  | 'accessories' | 'construction' | 'energy'

CategoryNode = {
  slug: string
  rid: string
  label: string
  image: string | null
  imageUrl: string | null   // absolute URL from config app.url
  children: CategoryNode[]   // infinite nesting via parent_id
}
```

Products, product images, cart items, and order items expose the same absolute
`imageUrl` alongside their relative `image` paths (detail galleries use `imageUrls`).

`GET /categories`, `GET /categories/:categoryId`, and `GET /categories/:categoryId/panel`
all accept `?depth=N` (`0` for no children, max `10`; omitted means the full tree).
Filtering `GET /products` by a parent `categoryId` includes all descendants.

Product = {
  rid: string
  categoryId: SidebarCategoryId
  subcategory: string
  image: string
  imageUrl: string
  tags: string[]           // all tags, in display order; tags[0] is the storefront badge
  category: string
  name: string
  priceMoney: Money
  priceInclTaxMoney: Money | null   // price + destination tax; null without ?country= (prices are tax-exclusive, see Tax)
  taxRatePercent: number | null     // combined destination rate; null without ?country=
  originalPriceMoney?: Money
  discountPercent: number | null
  deliveryQuote: { free: boolean, fee: Money, minDays: number, maxDays: number } | null
  ratingValue: number
  reviewCount: number
  soldCount: number
  liked?: boolean
  inStock: boolean          // capability: the default variant can supply 1 unit
}

Money = { amount: number, currency: string }
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/categories` | No | Full category tree for nav/modal |
| `GET` | `/categories/:categoryId/panel` | No | Modal panel sections + subcategories |
| `GET` | `/products` | No | Filtered product listing |
| `GET` | `/products/featured` | No | Home “Featured items” |
| `GET` | `/products/new-arrivals` | No | Home “New Arrivals” |
| `GET` | `/products/:productId` | No | Product detail |
| `GET` | `/products/:productId/related` | No | “You may also like” |
| `GET` | `/products/:productId/reviews` | No | Paginated reviews |
| `GET` | `/products/recommendations` | Optional | Cart/checkout upsells |

#### `GET /categories`

**Response**
```json
{
  "categories": [
    {
      "rid": "c_9f2ab31c0de",
      "slug": "electronics",
      "label": "Electronics & Tech",
      "image": "…",
      "imageUrl": "…",
      "children": [{ "rid": "c_44b1…", "slug": "electronics-audio", "label": "Headphones & Audio", "image": "…", "imageUrl": "…", "children": [] }]
    }
  ]
}
```

#### `GET /products`

**Query params**

| Param | Maps to UI |
|-------|----------|
| `categoryId` | Category listing route (matches the category and all nested descendants) |
| `subcategory` | Legacy alias: matches a nested child category by label, rid, or slug |
| `q` | Search (same listing) |
| `minPrice`, `maxPrice` | Price filter |
| `minRating` | Rating filter |
| `country` | Destination for delivery info (ISO code); defaults to the signed-in customer's default address |
| `freeDelivery`, `maxDeliveryDays` | Delivery filters (need a destination) |
| `brand`, `color`, `screenSize` | Collapsed filter sections |
| `sort` | Sort order |
| `page`, `limit` | Pagination |

**Response**
```json
{
  "items": [/* Product[] */],
  "total": 120,
  "facets": {
    "brands": ["Sony", "Apple"],
    "colors": ["Black", "White"],
    "attributes": { "brand": ["Sony", "Apple"] },
    "attributeLabels": { "brand": "Brand" },
    "delivery": { "freeCount": 4, "deliveryDays": [3, 5] }
  }
}
```

Product cards carry `deliveryQuote` (`{ free, fee, minDays, maxDays }`, computed from shipping rules and variant handling time for the destination; `null` when the destination is unknown). See `docs/FRONTEND-API-CHANGES-ORDER-FIRST.md` section 10.

> **Note:** Price, rating, delivery, brand, color, and screen size filters are supported by the backend; `subcategory` remains as a legacy alias.

#### `GET /products/:productId`

**Response**

```json
{
  "product": { /* Product */ },
  "images": ["…"],
  "imageUrls": ["…"],
  "ratingValue": 4.7,
  "reviewCount": 3,
  "soldCount": 128,
  "priceMoney": { "amount": 179, "currency": "USD" },
  "priceCurrency": "USD",
  "discountNotice": "Get 10% off on your first order",
  "modelOptions": ["Standard", "Pro"],
  "variantOptions": [{ "rid": "pv_1", "name": "Standard", "size": "M", "color": "Navy" }],
  "descriptionLines": ["…"],
  "variants": [
    { "rid": "pv_1", "name": "Standard", "size": "M", "color": "Navy", "sku": "AEROSMART-EARBUDS-STD", "priceMoney": { "amount": 179, "currency": "USD" }, "priceInclTaxMoney": null, "isDefault": true, "stockQuantity": 12, "inStock": true, "handlingDays": 2, "deliveryQuote": null }
  ],
  "shippingFeeMoney": { "amount": 20, "currency": "USD" },
  "deliveryDays": { "min": 2, "max": 5 },
  "family": {
    "optionName": "Size",
    "options": [
      { "rid": "p_32", "value": "32 inch", "priceMoney": { "amount": 1500, "currency": "USD" }, "originalPriceMoney": null, "inStock": true, "imageUrl": "…", "isCurrent": true },
      { "rid": "p_43", "value": "43 inch", "priceMoney": { "amount": 2100, "currency": "USD" }, "originalPriceMoney": null, "inStock": true, "imageUrl": "…", "isCurrent": false }
    ]
  }
}
```

`ratingValue` (here and on list items) is the approved-review average, or `5` while `reviewCount` is 0, so unreviewed products start at five stars; show the count beside it. `family` lists separately uploaded products that share the admin "Size options" family key (one model in several sizes), in natural order of `value`, with the current product flagged; it is `null` unless at least two active products share the key.

Variants carry `size` and `color` separately for fashion options. `shippingFeeMoney` is
`null` when no rule applies. `stockQuantity: null` means the variant is not stock-tracked. List items also carry `inStock` and `attributes` (`[{ "key": "brand", "label": "Brand", "value": "Sony" }, ...]`, in category order, `label` being the display name staff set on the category); filter any attribute by key with `?attributes[key]=value`, and facets include `attributes` (`{ key: [values] }`) and `attributeLabels` (`{ key: label }`).

#### `GET /products/:productId/reviews`

**Response**
```json
{
  "reviews": [
    {
      "author": "vik***r",
      "location": "UAE",
      "createdAt": "2026-08-02T10:00:00+00:00",
      "rating": 4,
      "text": "Great product for the price…"
    }
  ],
  "total": 42,
  "avgRating": 4.7,
  "myReview": null
}
```

---

## 3. Search

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/products?q=` | No | Full-text product search |
| `GET` | `/search/suggestions` | No | Autocomplete as user types |

---

## 4. Cart

Used by: `ShopContext`, `CartView`, `OrderSummaryPanel`, `Nav` cart badge.

### Types

```ts
CartItem = {
  rid: string
  name: string
  variant: string
  variantRid: string
  sku: string
  image: string
  imageUrl: string
  currency: string
  price: number       // current unit price (major units); use priceMoney to format
  priceMoney: Money
  previousPrice: Money | null  // set when the price moved since the line was added
  quantity: number
  stockQuantity: number | null // null = not tracked
  available: boolean
  selected: boolean
  productRid: string
}

OrderSummary = {
  itemsTotal: Money
  itemsDiscount: Money
  subtotal: Money
  shipping: Money
  tax: Money | null        // null without a destination (?country= or default address)
  taxes: { name: string, ratePercent: number, amount: Money }[]
  total: Money
  totalIncludesTax: boolean
}
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/cart` | Guest/Yes | Get cart + summary |
| `POST` | `/cart/items` | Guest/Yes | Add item |
| `PATCH` | `/cart/items/:itemId` | Guest/Yes | Update quantity or selection |
| `DELETE` | `/cart/items/:itemId` | Guest/Yes | Remove one item |
| `DELETE` | `/cart/items` | Guest/Yes | Remove selected items |
| `PATCH` | `/cart/items/select-all` | Guest/Yes | Select/deselect all |
| `POST` | `/cart/items/move-to-wishlist` | Yes | Move selected to wishlist |
| `POST` | `/cart/merge` | Yes | Merge guest cart after login |

#### `POST /cart/items`

**Request**
```json
{ "productId": "x7k2m9p4q1rt", "variantId": "pv8n3c5d2w0e", "quantity": 1 }
```

**Response**
```json
{
  "items": [/* CartItem[] */],
  "summary": {
    "itemsTotal": { "amount": 1100, "currency": "USD" },
    "itemsDiscount": { "amount": -100, "currency": "USD" },
    "subtotal": { "amount": 1000, "currency": "USD" },
    "shipping": { "amount": 20, "currency": "USD" },
    "total": { "amount": 1020, "currency": "USD" }
  }
}
```

`variantId` is optional (the product's default variant is used). Each cart line is priced at today's price and carries `previousPrice` (set when the price moved since it was added), `variantRid`, `sku`, `stockQuantity` (`null` = not tracked) and `available`. Lines are priced in the shopper's currency (see Currency). Errors: `insufficient_stock` (422, `details.available`), `variant_not_found` (404). Guest carts are identified by the `X-Cart-Id` header (also set as a cookie) and merged on login via `POST /cart/merge`.

---

## 5. Wishlist

Used by: `ShopContext`, `WishlistView`, product heart buttons.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/wishlist` | Yes | List wishlist products |
| `POST` | `/wishlist/:productId` | Yes | Add product |
| `DELETE` | `/wishlist/:productId` | Yes | Remove product |
| `GET` | `/wishlist/categories` | Yes | Category filter options for wishlist view |

#### `GET /wishlist`

**Query:** `category?`, `minRating?` (matches `WishlistView` filters)

**Response**
```json
{ "items": [/* Product[] */] }
```

---

## 6. Checkout & Orders

Used by: `CheckoutView`, `OrderCompletedView`, `YourOrdersView`, `OrderSummaryPanel`.

### Types

```ts
CheckoutPaymentMethodId =
  | 'card' | 'apple_pay' | 'google_pay' | 'paypal' | 'tabby' | 'tamara'

OrderStatus = 'pending_payment' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
OrderPaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded'
OrderFilter = 'all' | OrderStatus | 'returns'

OrderRecord = {
  rid: string
  status: OrderStatus
  paymentStatus: OrderPaymentStatus
  statusDate: string | null // ISO date for the status (delivered/shipped/placed)
  placedAt: string | null   // ISO order date
  itemCount: number
  totalMoney: Money
  productImages: string[]
}
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/checkout/preview` | Guest/Yes | Checkout page data (shipping fee is portal-configured) |
| `POST` | `/checkout/shipping-quote` | Guest/Yes | Shipping fee + delivery window |
| `POST` | `/orders` | Yes | Place order (awaiting payment). Requires `Idempotency-Key` |
| `POST` | `/checkout/payment-intent` | Yes | Pay an order. Requires `Idempotency-Key` |
| `GET` | `/orders` | Yes | Account order list |
| `GET` | `/orders/:orderId` | Yes | Order detail |
| `GET` | `/orders/buy-again` | Yes | Buy-again sidebar products |
| `POST` | `/orders/:orderId/buy-again` | Yes | Re-add order items to cart |
| `POST` | `/orders/:orderId/cancel` | Yes | Cancel an order awaiting payment |
| `POST` | `/orders/:orderId/return` | Yes | Return/refund request |
| `GET` | `/orders/:orderId/tracking` | Yes | Tracking timeline |

#### `GET /checkout/preview`

**Response**
```json
{
  "items": [/* CartItem[] */],
  "address": {
    "contact": "Vikers Junior | +233 24 123 4567",
    "line1": "Hse 8 M Street",
    "line2": "Accra Ghana"
  },
  "shipping": {
    "feeMoney": { "amount": 200, "currency": "USD" },
    "deliveryDays": { "min": 5, "max": 9 },
    "courierLabel": "Courier company:"
  },
  "paymentMethods": [
    { "rid": "pm_a1b2c3d4e5f6", "code": "card", "label": "Card", "icon": "card", "iconUrl": null },
    { "rid": "pm_f6e5d4c3b2a1", "code": "apple_pay", "label": "Apple Pay", "icon": "apple_pay", "iconUrl": null }
  ]
}
```

#### Checkout sequence

1. `POST /orders` creates the order with `status: pending_payment`, totals fixed at current prices, and stock held.
2. `POST /checkout/payment-intent` with that `orderId` charges exactly the order total.
3. On return, poll `GET /payments/:paymentId`; the webhook marks the order `paid` and `processing`.

Unpaid orders are cancelled after `PAYMENTS_ORDER_PAYMENT_WINDOW_MINUTES` (default 60) and their stock is released.

Both POSTs require an `Idempotency-Key` header. One key per checkout session is enough: keys are scoped per endpoint, so the same key can place the order and open the payment, and JSON key order does not count as a different request. Missing gives `428 idempotency_key_required`; a retry of a successful request replays the stored response with `Idempotent-Replayed: true`; a retry while the first is still running gives `409 idempotency_in_progress`; **any failed attempt frees the key**, so a corrected request can be sent with the same key (including after `409 price_changed`); and `422 idempotency_key_reused` (with `details.route`) means the key already completed a *different* request on that endpoint. Client guide: `docs/FRONTEND-API-CHANGES-ORDER-FIRST.md`.

#### `POST /checkout/payment-intent`

**Request**
```json
{ "orderId": "8efrrdn8u9ei", "paymentMethodId": "mtn_momo" }
```

`paymentMethodId` (rid or code) is optional. Given, its provider is used and the method must serve the order currency (`404 payment_method_not_found`, `422 payment_method_unavailable`). Omitted, the order currency's provider applies.

**Response**
```json
{
  "checkoutUrl": "https://checkout.stripe.com/...",
  "paymentRid": "pay_abc123",
  "provider": "stripe",
  "orderId": "8efrrdn8u9ei",
  "amount": { "amount": 199.0, "currency": "USD" }
}
```

Errors: `order_not_found` (404), `order_already_paid` (409), `order_not_payable` (409, cancelled). A failed payment leaves the order payable; call again to retry.

The backend determines the provider, email, return, and cancel-return URLs. The client only redirects the user to `checkoutUrl`. On return, identify the payment by the `reference` query param (our payment rid); the `provider` for that payment was already returned by payment-intent.

#### `GET /payments/:paymentId`

Auth required. Returns the payment status for a payment owned by the authenticated user. Poll this after the provider redirects back (using `reference` from the return URL) instead of trusting redirect params.

**Response**
```json
{
  "rid": "pay_abc123",
  "provider": "stripe",
  "status": "pending",
  "amount": { "amount": 199.0, "currency": "USD" },
  "orderId": null
}
```

---

#### `POST /orders`

**Request** (header `Idempotency-Key: <uuid>`)
```json
{
  "addressId": "addr_123",
  "cartItemIds": ["line_1", "line_2"]
}
```

**Response** `201`
```json
{
  "orderId": "8efrrdn8u9ei",
  "orderReference": "#HCO5241124542",
  "estimatedDelivery": "Estimated delivery date: 3-5 business days",
  "status": "pending_payment",
  "paymentStatus": "unpaid",
  "total": { "amount": 199.0, "currency": "USD" }
}
```

Conflicts (`409`): `price_changed` (prices moved since the shopper added the items; `details.items[]` has `cartItemId`, `previousPrice` and `price`, and the next attempt with a new key succeeds), `insufficient_stock`, `item_unavailable`, `cart_changed`.

#### `GET /orders`

**Query:** `status` (`all` \| `returns` \| `pending_payment` \| `processing` \| `shipped` \| `delivered` \| `cancelled`), `search` (order ID), `page`, `limit`. Each order has `status` (fulfilment) and `paymentStatus` (`unpaid` \| `paid` \| `failed` \| `refunded`).

**Response**
```json
{ "orders": [/* OrderRecord[] */], "total": 15 }
```

#### `GET /orders/:orderId`

Order detail spreads the `OrderRecord` plus `orderReference`, `estimatedDelivery`, `paymentMethod`, `currency`, `items` (`unitPrice` is `Money`), `totals` (all `Money`: `itemsTotal`, `itemsDiscount`, `shipping`, `tax`, `total`), `taxes` (per-component `{ name, ratePercent, taxable: Money, amount: Money }`), `address`, `shipping`, `returns` and `tracking`, plus `returnEligibility` (`{ eligible, reason, windowDays, deadline }` from the items' categories and the real delivered date).

Returns are only available after shipping or delivery, for returnable categories within their window: `POST /orders/:orderId/return` gives `return_not_allowed` (422) otherwise, and `return_already_open` (422) when a request is already open.

`POST /orders/:orderId/cancel` takes an optional `reason` and only works while the order is `pending_payment` and unpaid or failed, which is when nothing has been charged, so it just releases the stock held for the order. A paid order answers `order_not_cancellable` (409) because cancelling it needs a refund, which staff issue by hand; a dispatched order is refused the same way and belongs in the return flow above. Cancelling an already cancelled order returns `200` rather than an error, so a client retrying after a timeout is not told the request failed. A charge that lands after a cancellation is flagged `needs_review` for staff rather than settling the order.

---

## Currency

Catalog, cart and order amounts are in the shopper's currency. The country is resolved in this order: `?country=` (ISO code, rid or name), then the signed-in shopper's `preferred_country`, then the `assigned_country` we recorded from their IP the first time we saw them, then the live visitor IP, then the default currency's own country (`currencies.country_code`). Its currency is used when the store sells in it (a row in the admin Currencies page) and has an exchange rate younger than 36 hours; otherwise everything is in the default currency (USD). `GET /locale` returns `{ country, countrySource: query|preferred|assigned|ip|default, currency: { code, name, decimalPlaces } }`.

- `PUT /users/me/country { preferredCountry }` stores the shopper's own choice (ISO code, rid or name; `null` clears it). It wins over their IP, so a traveller keeps their currency until they change it. The response is the resulting locale, so prices can be re-rendered without a second call. Signed-in shoppers need no `?country=` on catalog, cart, checkout and order calls: their stored country already picks the currency, and `?country=` still wins when sent.
- Send the same `?country=` (or none) on catalog, cart, checkout and order calls, so the cart and the order stay in one currency.
- Converted prices are the market rate plus a markup, rounded up to the currency's minor unit. `minPrice`/`maxPrice` and price sorting use the shopper's currency.
- Orders freeze the converted prices and are charged in that currency (the provider is chosen per currency). Rate updates reprice the cart but never cause `price_changed`; only product price changes do.
- Signing in with a guest cart in a different currency from a non-empty account cart drops the guest cart.
- `503 exchange_rate_unavailable` means a needed rate is missing or too old; retry later.
- `country: null` with `countrySource: default` means the store could not place the shopper and its default currency has no `country_code`, so delivery claims and tax are off. `CurrencySeeder` sets it; see the admin Currencies page.
- Payment methods are filtered by the currency the order will be charged in, plus the destination when one is known. `GET /payment-methods/checkout` resolves both itself when you omit the params, so a client needs to send nothing. A method row is scoped to a currency and to a country independently, so an empty list is possible and means the two cannot be served together, not that nothing is configured.

## Tax

Prices are tax-exclusive. Tax is added for the destination country at checkout, quoting, and order placement; without a known destination (`?country=` or the signed-in customer's default address) no tax is charged and cart `tax` is `null` (`totalIncludesTax: false`).

Only countries with rates are taxed (the store collects where it is registered): the UAE (5% VAT) and Ghana (NHIL 2.5% + GETFund Levy 2.5%, with 15% VAT charged on the levies-inclusive base). Products outside the standard rate belong to a tax class (for example zero-rated). Orders keep the tax they charged per component (`taxes[]`: `{ name, ratePercent, taxable: Money, amount: Money }`) and per item, and their total includes tax. Listings and product detail expose `priceInclTaxMoney` and `taxRatePercent` for a known destination (show the tax-inclusive price where consumer prices must include VAT).

---

## 7. User Profile & Security

Used by: `ProfilePanel`, `EditProfileModal`, account profile/security tabs.

### Types (from `src/data/profile.ts`)

```ts
UserProfile = { fullName: string, email: string, initials: string }

DefaultAddress = {
  contactName: string
  phone: string
  line1: string
  line2: string
}

SecuritySettings = {
  email: string
  phone: string | null
  twoFactorEnabled: boolean
}
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/users/me/profile` | Yes | Personal info + summaries |
| `PATCH` | `/users/me/profile` | Yes | Update name, avatar |
| `PUT` | `/users/me/country` | Yes | Preferred country; null clears. Wins over assigned and IP |
| `GET` | `/users/me/security` | Yes | Security settings |
| `PATCH` | `/users/me/email` | Yes | Change email |
| `PATCH` | `/users/me/phone` | Yes | Add/update phone |
| `PATCH` | `/users/me/password` | Yes | Change password |
| `POST` | `/users/me/2fa/enable` | Yes | Enable 2FA |
| `POST` | `/users/me/2fa/disable` | Yes | Disable 2FA |
| `DELETE` | `/users/me` | Yes | Delete account |

---

## 8. Addresses

Used by: `AddressesPanel`, `AddAddressModal`, checkout shipping.

### Types (from `src/data/addresses.ts`)

```ts
AddressRecord = {
  rid: string
  country: string
  firstName: string
  lastName: string
  phoneCountryCode: string
  phoneNumber: string
  addressLine: string
  region: string
  city: string
  cityLine: string
  isDefault: boolean
}
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/addresses` | Yes | List addresses |
| `POST` | `/addresses` | Yes | Create |
| `PATCH` | `/addresses/:id` | Yes | Update |
| `DELETE` | `/addresses/:id` | Yes | Delete |
| `PATCH` | `/addresses/:id/default` | Yes | Set default |
| `POST` | `/addresses/:id/duplicate` | Yes | Duplicate address |
| `GET` | `/addresses/lookup/countries` | No | Country dropdown |
| `GET` | `/addresses/lookup/regions` | No | Regions by country |
| `GET` | `/addresses/lookup/cities` | No | Cities by region |

---

## 9. Saved Payment Methods

Used by: `PaymentMethodsPanel`, `AddPaymentMethodModal`, checkout.

### Types (from `src/data/paymentMethods.ts`)

```ts
PaymentMethodType = 'paypal' | 'visa' | 'mobile_money'

PaymentMethodRecord = {
  rid: string
  cardholderName: string
  type: PaymentMethodType
  maskedDetail: string
  network?: string
  isDefault: boolean
}
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/payment-methods` | Yes | List saved methods |
| `DELETE` | `/payment-methods/:id` | Yes | Delete |
| `PATCH` | `/payment-methods/:id/default` | Yes | Set default |
| `GET` | `/payment-methods/networks` | No | Mobile money networks (MTN, Vodafone Cash, etc.) |
| `GET` | `/payment-methods/checkout?currency=&country=` | No | Checkout methods for a currency and destination; both params optional and resolved when omitted |

Checkout routing is by method plus currency (full note: `docs/PAYMENT-METHODS.md`).

> **PCI:** Card numbers collected in checkout UI must be tokenized via your payment provider. Never store raw PAN/CVC.

---

## 10. Reviews (Account)

Used by: `YourOrdersView` reviews tab, `AddReviewModal`.

### Types (from `src/data/reviews.ts`)

```ts
ReviewFilter = 'waiting' | 'reviewed'

WaitingReviewRecord = {
  rid: string
  productName: string
  productImage: string
  orderId: string
  deliveredAt: string | null
  priceCurrency: string
  priceMoney: Money
  quantity: number
}
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/reviews/waiting` | Yes | Products awaiting review |
| `GET` | `/reviews/reviewed` | Yes | Submitted reviews |
| `POST` | `/reviews` | Yes | Submit a review |

`myReview` is the signed-in caller's own review of this product in any status (`"status": "pending" | "published"`), so a review awaiting approval still shows to its author; `null` for guests and for shoppers who have not reviewed it.

#### `POST /reviews`

An order line can be reviewed once its order is paid (`payment_status = paid`) and not cancelled; it does not have to be delivered first. Reviews publish after staff approve them in the admin Reviews page.

**Request**
```json
{
  "reviewId": "rev_123",
  "rating": 5,
  "title": "Great product",
  "detailedReview": "Delivered on time, would buy again."
}
```

---

## 11. Browsing History

Used by: `BrowsingHistoryPanel`.

### Types (from `src/data/browsingHistory.ts`)

```ts
BrowsingHistorySection = {
  id: string          // bucket key: today | yesterday | older
  label: string       // e.g. "Today", "Yesterday"
  items: { rid: string, product: Product }[]
}
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/browsing-history` | Yes | Date-grouped history |
| `POST` | `/browsing-history` | Optional | Record product view |
| `DELETE` | `/browsing-history` | Yes | Delete selected items |
| `DELETE` | `/browsing-history/all` | Yes | Clear all |

#### `POST /browsing-history`

**Request**
```json
{ "productId": "x7k2m9p4q1rt" }
```

Call when a user opens a product detail page.

---

## 12. Notification Preferences

Used by: `NotificationsPanel`.

### Types (from `src/data/notifications.ts`)

```ts
NotificationSettingId = 'promotions' | 'orderUpdates'

NotificationSetting = {
  id: NotificationSettingId
  title: string
  description: string
  enabled: boolean
}
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/notifications/settings` | Yes | Get preferences |
| `PATCH` | `/notifications/settings/:id` | Yes | Toggle a setting |

---

## 13. CMS & Content

Home hero/promo, footer links, and legal/about pages come from the backend.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/content/pages/:slug` | No | Legal/about page content |
| `GET` | `/content/home` | No | Free-form home content (banners come from `/placements/home`) |
| `GET` | `/content/footer` | No | Footer columns and links |
| `GET` | `/placements/:page` | No | Staff-managed banners for a page (`?position=` optional) |

### Placements (banners)

Staff manage banners in the admin under **Content → Banners**. A banner sits in a slot, which is a page plus a position. The slots are fixed in code (`InhousePlacement::SLOTS`), because each one needs a storefront component that renders it:

| Page | Position | Storefront component |
|------|----------|----------------------|
| `home` | `hero` | `HeroSection`, the carousel at the top of the home page |
| `home` | `promo` | `PromoBannerSection`, the carousel near the bottom of the home page |
| `site` | `nav_video` | The thin video strip in `Nav`, on every page (desktop). A video: `videoUrl` is the video and `imageUrl` its poster. See `docs/FRONTEND-NAV-VIDEO.md`. |

`GET /placements/home` returns the active banners of every position on that page, ordered by `sortOrder`. Group them by `position` on the client. Add `?position=hero` to get one position only. An unknown page answers `404 placement_page_not_found`, and an unknown position answers `422`.

```json
{
  "items": [
    {
      "rid": "a1b2c3d4e5f6",
      "position": "hero",
      "imageUrl": "https://hcomall.com/storage/uploads/placements/x.jpg",
      "videoUrl": null,
      "altText": "Living room with a grey sofa",
      "title": null,
      "description": null,
      "buttonText": null,
      "linkUrl": "/category/furniture"
    }
  ]
}
```

Every field except `rid`, `position` and `imageUrl` can be `null`. `videoUrl` is set only for video slots (`site.nav_video`), where `imageUrl` is the poster. `linkUrl` is either a full URL or a storefront path that starts with `/`. If a position has no items, the storefront hides that carousel.

### Page slugs

| Slug | Frontend route |
|------|----------------|
| `about` | `/about` |
| `privacy-policy` | `/privacy-policy` |
| `warranty` | `/warranty` |
| `shipping-delivery` | `/shipping-delivery` |
| `return-refund` | `/return-refund` |
| `secure-payments` | `/secure-payments` |
| `intellectual-property` | `/intellectual-property` |
| `terms-of-use` | *(not built yet — linked from sign-in/checkout copy)* |

#### `GET /content/pages/:slug`

**Response**
```json
{
  "title": "H&CO. Privacy Policy",
  "lastUpdated": "January 1, 2026",
  "intro": ["…"],
  "blocks": [
    { "type": "heading", "text": "1. Introduction" },
    { "type": "paragraph", "text": "…" },
    { "type": "bullets", "items": ["…"] }
  ]
}
```

---

## 14. Marketing & Newsletter

Used by: `Footer` subscribe form (UI only).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/newsletter/subscribe` | No | Email signup |
| `POST` | `/newsletter/unsubscribe` | No | Unsubscribe via token |

#### `POST /newsletter/subscribe`

**Request**
```json
{ "email": "user@example.com" }
```

---

## 15. Affiliate & Support (Footer placeholders)

Footer links exist without routes today. APIs may be needed later:

| Feature | Suggested endpoint |
|---------|-------------------|
| Affiliate / influencer program | `POST /partnerships/inquiries` |
| Request quotation | `POST /quotations` |
| Connect with agent | `POST /support/agent-requests` |
| Live chat | WebSocket or third-party (Intercom, Zendesk) |

---

## Implementation Priority

### Phase 1 — Core store (MVP)

1. **Auth** — login, register, `/auth/me`, guest cart merge
2. **Catalog** — categories, product list, product detail, reviews
3. **Cart** — full CRUD + summary
4. **Checkout & orders** — preview, shipping quote, place order, order confirmation
5. **Addresses** — CRUD + default

### Phase 2 — Account & engagement

6. **Wishlist**
7. **Orders list** — filters, search, buy again, tracking, returns
8. **Saved payment methods**
9. **Reviews** — waiting/reviewed, submit
10. **Search** — `GET /products?q=`

### Phase 3 — Polish

11. **Browsing history**
12. **Notification preferences**
13. **CMS content** (if moving off static TS files)
14. **Newsletter**
15. **OAuth** (Google done; Facebook, Apple later)
16. **Product recommendations** for cart/checkout carousels

---

## Environment Variables (Frontend)

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | REST API base URL |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Client-side payment (if using Stripe) |
| `VITE_FACEBOOK_APP_ID` | Facebook OAuth |
| `VITE_APPLE_CLIENT_ID` | Apple Sign In |

---

## Webhooks (Backend → Payment Providers)

Not called by the frontend directly, but required for a real checkout flow:

| Event | Purpose |
|-------|---------|
| `payment_intent.succeeded` | Mark order paid, send confirmation email |
| `payment_intent.failed` | Release inventory, notify user |
| `charge.refunded` | Update order/return status |

---

## Related Source Files

| Area | Files |
|------|-------|
| Products | `app/Http/Controllers/Api/V1/ProductController.php`, `app/Services/ProductQueryService.php`, `app/Support/ProductMapper.php` |
| Categories | `app/Http/Controllers/Api/V1/CategoryController.php`, `app/Models/Category.php` |
| Cart / checkout | `app/Services/CartService.php`, `app/Http/Controllers/Api/V1/CheckoutController.php` |
| Orders / tax / shipping | `app/Services/OrderService.php`, `app/Tax/TaxCalculator.php`, `app/Services/ShippingService.php` |
| Auth | `app/Http/Controllers/Api/V1/AuthController.php` |
| Admin | `app/Http/Controllers/Admin/*`, `resources/js/Pages/Admin/*` |
