# HandCO API Specification

Backend API reference for the H&CO ecommerce frontend. Derived from current routes, data models, and user flows in `src/`.

**Status:** The frontend is mock-data only today — no HTTP client, env vars, or persistence. This document defines what the backend needs to implement.

---

## Conventions

| Item | Recommendation |
|------|----------------|
| Base URL | `https://api.handco.example/v1` (configure via `VITE_API_BASE_URL`) |
| Format | JSON request/response bodies |
| Auth | `Authorization: Bearer <access_token>` for protected routes |
| Guest cart | `X-Cart-Id` header or `cart_id` cookie for unauthenticated sessions |
| Errors | `{ "error": { "code": string, "message": string, "details?": object } }` |
| Pagination | `?page=1&limit=20` → `{ items, total, page, limit }` |
| Money | Prefer structured `{ amount: number, currency: "AED" }` over display strings like `"AED 179.00"` |
| IDs | Product IDs match catalog (`aerosmart-earbuds`, etc.); orders use references like `#HCO5241124542` |

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
| `POST` | `/auth/login` | No | Email + password login |
| `POST` | `/auth/register` | No | Create account after email step |
| `POST` | `/auth/oauth/:provider` | No | Social login (`google`, `facebook`, `apple`) |
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

#### `POST /auth/login`

**Request**
```json
{ "email": "user@example.com", "password": "••••••••" }
```

**Response**
```json
{
  "user": { "displayName": "Vikers", "fullName": "Vikers Junior", "email": "user@example.com" },
  "accessToken": "…",
  "refreshToken": "…"
}
```

#### `POST /auth/oauth/:provider`

**Request**
```json
{ "idToken": "…" }
```

**Response** — same shape as login.

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

Subcategory = { label: string, image: string }

Product = {
  id: string
  categoryId: SidebarCategoryId
  subcategory: string
  image: string
  tag: string
  category: string
  name: string
  price: string              // display; prefer Money in API
  originalPrice?: string
  discount?: string
  delivery: string
  rating: string
  liked?: boolean
  showAddButton?: boolean
  priceOrange?: boolean
  imageObjectPosition?: string
}
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
      "id": "electronics",
      "label": "Electronics & Tech",
      "subcategories": [{ "label": "Headphones & Audio", "image": "…" }]
    }
  ]
}
```

#### `GET /products`

**Query params**

| Param | Maps to UI |
|-------|----------|
| `categoryId` | Category listing route |
| `subcategory` | Subcategory chips / modal selection |
| `q` | Search (nav search — not wired yet) |
| `minPrice`, `maxPrice` | Price filter |
| `minRating` | Rating filter |
| `delivery` | Delivery filter (`Free delivery`, `Delivery in 1 day`, etc.) |
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
    "deliveryOptions": ["Free delivery", "Delivery in 3 days"]
  }
}
```

> **Note:** Only subcategory filtering works client-side today. Price, rating, delivery, brand, color, and screen size filters are UI-only and need backend support.

#### `GET /products/:productId`

**Response** (from `src/data/productDetail.ts`)

```json
{
  "product": { /* Product */ },
  "images": ["…"],
  "ratingValue": 4.7,
  "reviewCount": 3,
  "soldCount": 128,
  "priceAmount": "179.00",
  "priceCurrency": "AED",
  "discountNotice": "Get 10% off on your first order",
  "modelOptions": ["Standard", "Pro"],
  "descriptionLines": ["…"],
  "shippingFee": "AED 179.00",
  "deliveryEstimate": "2-5 business days"
}
```

#### `GET /products/:productId/reviews`

**Response**
```json
{
  "reviews": [
    {
      "author": "vik***r",
      "location": "UAE",
      "date": "Aug 2, 2026",
      "rating": 4,
      "text": "Great product for the price…"
    }
  ],
  "total": 42,
  "avgRating": 4.7
}
```

---

## 3. Search

Used by: `Nav` search bar (placeholder only — not implemented).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/products/search` | No | Full-text product search |
| `GET` | `/search/suggestions` | No | Autocomplete as user types |

#### `GET /products/search`

**Query:** `q`, plus same filter params as `GET /products`.

**Response:** Same as `GET /products`.

> **Frontend gap:** Add `/search?q=` route and wire nav input to this endpoint.

---

## 4. Cart

Used by: `ShopContext`, `CartView`, `OrderSummaryPanel`, `Nav` cart badge.

### Types (from `src/data/cart.ts`)

```ts
CartItem = {
  id: string          // product id today; should become line-item id
  name: string
  variant: string     // hardcoded "Standard" — needs SKU/variant id
  image: string
  currency: string
  price: number
  quantity: number
  selected: boolean
}

OrderSummary = {
  itemsTotal: string
  itemsDiscount: string
  subtotal: string
  shipping: string
  total: string
  currency: string
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
{ "productId": "aerosmart-earbuds", "variantId": "standard", "quantity": 1 }
```

**Response**
```json
{
  "items": [/* CartItem[] */],
  "summary": {
    "itemsTotal": { "amount": 1100, "currency": "AED" },
    "itemsDiscount": { "amount": -100, "currency": "AED" },
    "subtotal": { "amount": 1000, "currency": "AED" },
    "shipping": { "amount": 20, "currency": "AED" },
    "total": { "amount": 1020, "currency": "AED" }
  }
}
```

> **Note:** Cart is in-memory only (`ShopContext`). Lost on refresh. Guest cart cookie + merge on login is required.

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

OrderStatus = 'delivered' | 'processing' | 'shipped'
OrderFilter = 'all' | OrderStatus | 'returns'

OrderRecord = {
  id: string
  status: OrderStatus
  statusDateLabel: string
  statusBadgeLabel: string
  itemCount: number
  total: string
  orderTime: string
  productImages: string[]
}
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/checkout/preview` | Guest/Yes | Checkout page data |
| `POST` | `/checkout/shipping-quote` | Guest/Yes | Shipping fee + delivery window |
| `POST` | `/checkout/payment-intent` | Guest/Yes | Initialize payment (Stripe/Adyen/etc.) |
| `POST` | `/orders` | Yes | Place order |
| `GET` | `/orders` | Yes | Account order list |
| `GET` | `/orders/:orderId` | Yes | Order detail |
| `GET` | `/orders/buy-again` | Yes | Buy-again sidebar products |
| `POST` | `/orders/:orderId/buy-again` | Yes | Re-add order items to cart |
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
    "fee": "AED 200",
    "deliveryWindow": "Delivery: Aug 29-Sep 20",
    "courierLabel": "Courier company:"
  },
  "paymentMethods": [
    { "id": "card", "label": "Card", "icon": "…" },
    { "id": "apple_pay", "label": "Apple Pay", "icon": "…" }
  ]
}
```

#### `POST /orders`

**Request**
```json
{
  "addressId": "addr_123",
  "paymentMethodId": "card",
  "paymentToken": "tok_…",
  "cartItemIds": ["line_1", "line_2"]
}
```

**Response**
```json
{
  "orderId": "PO-077-08907616420471803",
  "orderReference": "#HCO5241124542",
  "estimatedDelivery": "Estimated delivery date: 24-36 May",
  "status": "processing"
}
```

> **Note:** `handleSubmitOrder` today only clears the cart and navigates to `/order-complete`. No order is created server-side.

#### `GET /orders`

**Query:** `status` (`all` \| `processing` \| `shipped` \| `delivered` \| `returns`), `search` (order ID), `page`, `limit`

**Response**
```json
{ "orders": [/* OrderRecord[] */], "total": 15 }
```

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
  id: string
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
  id: string
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
| `POST` | `/payment-methods` | Yes | Add (tokenize server-side) |
| `PATCH` | `/payment-methods/:id` | Yes | Update |
| `DELETE` | `/payment-methods/:id` | Yes | Delete |
| `PATCH` | `/payment-methods/:id/default` | Yes | Set default |
| `GET` | `/payment-methods/networks` | No | Mobile money networks (MTN, Vodafone Cash, etc.) |

> **PCI:** Card numbers collected in checkout UI must be tokenized via your payment provider. Never store raw PAN/CVC.

---

## 10. Reviews (Account)

Used by: `YourOrdersView` reviews tab, `AddReviewModal`.

### Types (from `src/data/reviews.ts`)

```ts
ReviewFilter = 'waiting' | 'reviewed'

WaitingReviewRecord = {
  id: string
  productName: string
  productImage: string
  orderId: string
  deliveredOn: string
  priceCurrency: string
  priceAmount: string
  quantity: number
}
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/reviews/waiting` | Yes | Products awaiting review |
| `GET` | `/reviews/reviewed` | Yes | Submitted reviews |
| `POST` | `/reviews` | Yes | Submit a review |

#### `POST /reviews`

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
  id: string
  label: string        // e.g. "Today", "Yesterday"
  items: { id: string, product: Product }[]
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
{ "productId": "aerosmart-earbuds" }
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

Used by: legal pages, about page, home hero/promo, footer links.

Static content today lives in `src/data/*.ts`. Can remain static or move to a headless CMS.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/content/pages/:slug` | No | Legal/about page content |
| `GET` | `/content/home` | No | Hero banners, promo banner, features |
| `GET` | `/content/footer` | No | Footer columns and links |

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
10. **Search** — wire nav + `/search` route

### Phase 3 — Polish

11. **Browsing history**
12. **Notification preferences**
13. **CMS content** (if moving off static TS files)
14. **Newsletter**
15. **OAuth** (Google, Facebook, Apple)
16. **Product recommendations** for cart/checkout carousels

---

## Environment Variables (Frontend)

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | REST API base URL |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Client-side payment (if using Stripe) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth |
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
| Products | `src/data/products.ts`, `src/data/products.json`, `src/data/productDetail.ts` |
| Categories | `src/data/categoriesModal.ts`, `src/data/categoryListing.ts` |
| Cart / checkout | `src/data/cart.ts`, `src/components/CartView.tsx`, `src/components/CheckoutView.tsx` |
| Shop state | `src/context/ShopContext.tsx` |
| Auth | `src/data/auth.ts`, `src/components/SignInModal.tsx` |
| Account | `src/data/orders.ts`, `src/data/reviews.ts`, `src/data/profile.ts`, `src/data/addresses.ts`, `src/data/paymentMethods.ts`, `src/data/browsingHistory.ts`, `src/data/notifications.ts` |
| Routes | `src/App.tsx`, `src/data/shopRoutes.ts`, `src/data/accountRoutes.ts` |
| Legal / CMS | `src/data/privacyPolicy.ts`, `src/data/warrantyPolicy.ts`, etc. |
