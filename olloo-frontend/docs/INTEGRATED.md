# HandCO Frontend — Integrated

What is wired to the HandCO customer API from `docs/backend-docs`. The UI layout
and styling were **not changed** for this work — only data sources and actions
were connected to live endpoints.

**API base URL:** `https://handco.craftsmanjohn.com/api/v1`
**Config:** `.env` / `.env.example` → `VITE_API_BASE_URL`
**Demo account:** `demo@handco.test` / `password` (or `jaygrey.jg@gmail.com` / `password`)

**Related documents**
- [NOT-INTEGRATED.md](./NOT-INTEGRATED.md) — gaps and partial integrations
- [OPENAPI-AUDIT-REPORT.md](./OPENAPI-AUDIT-REPORT.md) — contract audit; nine
  field-name and response-shape defects found and fixed (2026-10-04)
- [FRONTEND-API-CHANGES.md](./FRONTEND-API-CHANGES.md) — original API change log
  (**partly superseded**, see its section below)
- [07-checkout-flow.postman_flow.json](./07-checkout-flow.postman_flow.json)

---

## Contract audit corrections (2026-10-04)

The client was audited line-by-line against `docs/backend-docs/openapi.yaml`.
Nine defects were fixed; the ones that changed observable behaviour are listed
here because they correct claims made elsewhere in this document.

| Was | Now | Effect |
|-----|-----|--------|
| `PlaceOrderResponse.total` | `totalMoney` | Type promised a field the API never sends; read `undefined` |
| `DELETE /browsing-history` body `{rids}` | `{ids}` | **Request was rejected outright** — history could not be deleted |
| `submitQuotation` sent `details` | `name` + `message` | Would have failed `422`; `details` is not a spec field |
| `submitAgentRequest` missing `name` | `name` required | Same latent `422` |
| `facets.delivery.maxDays` | `deliveryDays` | **Delivery-speed filter options silently vanished** |
| `getPaymentNetworks` typed `string[]` | `{id, label}[]` | Type did not match the wire shape |
| `getWishlistCategories` typed `string[]` | `{rid, slug, label}[]` | Same |
| `returnOrder` returned `void` | Returns `{success, returnId, rid, status}` | Response body was discarded |
| `GET /reviews/*` sent `page`/`limit` | Trimmed client-side | Endpoints accept neither param |

**The two that mattered most.** `deleteBrowsingHistory` sent the wrong body key,
so browsing-history deletion failed on every attempt. The delivery facet read
`maxDays` where the API sends `deliveryDays`; the `??` guard turned the mismatch
into an empty list, so the "Within N days" options disappeared from the filter
panel without any error — and only for shoppers with a known destination country,
because the facet is legitimately `null` for guests. That second one was masked
by working `freeCount` handling.

Full detail, including the two items deliberately **not** changed, is in the
[audit report](./OPENAPI-AUDIT-REPORT.md).

---

## Architecture

| Layer | Location | Purpose |
|-------|----------|---------|
| HTTP client | `src/api/client.ts` | JSON requests, Bearer auth, guest-only `X-Cart-Id`, 401 refresh retry |
| Token / cart storage | `src/api/storage.ts` | `sessionStorage` for access/refresh tokens and guest cart rid |
| Checkout handoff | `src/api/pendingPayment.ts` | Survives the provider redirect with payment + order reference |
| Payment redirect UI | `src/components/PaymentRedirectOverlay.tsx`, `PaymentErrorModal.tsx` | Blocking cover between submit and provider; payment-failure modal |
| Types & mappers | `src/api/types.ts`, `src/api/mappers.ts` | API shapes → existing UI types; relative image URLs resolved |
| Services | `src/api/services/*.ts` | One module per backend area (auth, catalog, cart, orders, account, forms, cms) |
| Auth state | `src/context/AuthContext.tsx` | Session bootstrap, sign-in, register, sign-out, `adoptSession` for OAuth |
| Shop state | `src/context/ShopContext.tsx` | Cart, wishlist, order summary, last placed order |
| Catalog state | `src/context/CatalogContext.tsx` | Categories, facets, featured and new-arrival products |
| Catalog hooks | `src/hooks/useCatalogProducts.ts` | Featured, new arrivals, listings, recommendations |
| Search hooks | `src/hooks/useProductSearch.ts` | Search results, facets and Nav suggestions |
| Default address | `src/hooks/useDefaultAddress.ts` | One source shared by Your Profile and Checkout |
| Payment networks | `src/hooks/usePaymentNetworks.ts` | Backend-owned mobile-money network list, shared |
| Destination | `src/hooks/useProductDestination.ts` | Resolves `?country=` for delivery quotes and tax |
| CMS hook | `src/hooks/useCmsPage.ts` | Legal pages with static fallback |

**Service surface:** 84 exported functions across 9 modules. 15 have no caller
outside `src/api/services/` — listed in
[NOT-INTEGRATED.md](./NOT-INTEGRATED.md#defined-but-never-called). (`listProducts`
and `searchProducts` are called by sibling functions in the same module, so a naive
text search counts them too; they are not gaps.)

**Provider order:** `BrowserRouter` → `AuthProvider` → `ShopProvider` → routes

---

## Authentication

| Endpoint | UI / behavior |
|----------|----------------|
| `POST /auth/check-email` | Email-first flow in `SignInModal` |
| `POST /auth/login` | Sign in with password |
| `POST /auth/register` | New account registration |
| `GET /auth/me` | Session bootstrap on app load |
| `POST /auth/logout` | Sign out from account menu |
| `POST /auth/refresh` | Automatic retry in `api/client.ts` on 401 |
| `GET /auth/oauth/google/url` | "Continue with Google" — full-page redirect |
| `POST /auth/oauth/google` | Callback page — exchanges the one-time `code` |
| `POST /auth/forgot-password` | "Forgot password?" in `SignInModal` |

**Wired components:** `SignInModal`, `Nav` (via `useAuth`), `AuthContext`, `GoogleOAuthCallbackPage`

Also called on sign-in: `POST /cart/merge`, so the guest cart folds into the account.

### Password reset (request)

`SignInModal` has a third step, `forgot`, reachable from a **Forgot password?**
link on the password step. It collects the email and calls
`POST /auth/forgot-password` with `{ email }` (public, no auth, no cart).

The endpoint **always succeeds** — it answers identically whether or not the
address is registered, so it cannot be used to discover which emails have
accounts. Two consequences shaped the implementation:

- The confirmation shown is the API's own `message`, returned verbatim from
  `authApi.forgotPassword`, with a neutral fallback. It never claims the email
  "has been sent" outright.
- `checkEmail` is deliberately **not** called first. It would reveal whether an
  account exists before the reset mail is even requested, defeating the
  anti-enumeration design.

Errors are reported with `role="alert"`, the success with `role="status"` and
`aria-live="polite"`. After success the button becomes **Resend reset link**, and
Back returns to sign-in with the email preserved.

The reset half — `POST /auth/reset-password` (`{email, token, password,
password_confirmation}`) — is **not** integrated. It is only reachable from the
emailed link, so it needs a dedicated route that reads the link's query params.

### Google sign-in (OAuth)

Implemented per [GOOGLE-OAUTH.md](./GOOGLE-OAUTH.md). The API does all the Google
work, so the client ships no Google SDK, client id, or client secret.

1. **Start** — `GET /auth/oauth/google/url`, store `state` in `sessionStorage`
   (`api/googleOAuth.ts`), redirect with `window.location.assign`. A fresh
   `url`/`state` pair is fetched per click: `state` is single-use, 10-minute expiry.
2. **Callback** — route `/oauth/google/callback` (`GoogleOAuthCallbackPage`).
   Must match the `redirect_uri` registered with Google; exposed as
   `getGoogleOAuthCallbackPath()`, not configurable.
3. **Validate** — the query is parsed once in a lazy state initialiser, so an
   invalid or cancelled link errors immediately instead of flashing the loader.
   `code`/`state` are compared against the saved value, then both the query
   string and the saved state are cleared so a refresh cannot replay the code.
4. **Exchange** — `POST /auth/oauth/google` with `{ code, state }`, sending the
   guest `X-Cart-Id` so the guest cart merges. Tokens are stored as for email
   sign-in, then `adoptSession` updates `AuthContext` without a redundant
   `/auth/me` round trip.
5. **Return** — redirects to the saved return path (e.g. checkout) or home. The
   callback path is rejected on both write and read, so it can never be used as
   a destination.

Documented error codes (`oauth_invalid_state`, `oauth_failed`,
`oauth_email_unverified`, `oauth_account_conflict`, `validation_error`) map to
their own copy; any failure reopens the sign-in modal. `nextStep: "oauth"` from
`check-email` routes Google-only accounts to the Google button instead of a
password field they cannot use.

---

## Catalog & products

| Endpoint | UI / behavior |
|----------|----------------|
| `GET /products/new-arrivals` | Home — `NewArrivalsSection` |
| `GET /products/featured` | Home — `FeaturedItemsSection` |
| `GET /categories` | `CatalogContext` — drives every link bar entry, the categories modal, and listing filters |
| `GET /products` | Category listings — `CategoryListingView`; also search via `?q=` |
| `GET /search/suggestions` | Nav typeahead — `NavSearchBar` via `useSearchSuggestions` |
| `GET /products/:productRid` | Product detail — `HomePage` + `ProductDetailView` |
| `GET /products/:productRid/related` | "You may also like" |
| `GET /products/:productRid/reviews` | Reviews section on product detail |
| `GET /products/recommendations` | Cart & order-complete recommendation strips |

**Notes**
- Product URLs use API rids (e.g. `/products/aerosmart-earbuds`).
- Static product data remains as **fallback** when the API is unreachable.
- Search is API-first; the local `searchRelevance` synonym map only widens the
  query so related terms (e.g. "shoe" → sneakers) reach the same endpoint.
- `GET /categories/:id/panel` is implemented (`catalogApi.getCategoryPanel`) but
  **not called** — it returns the same tree as `GET /categories`, so the modal
  reads from `useCatalog()` instead of adding a request per open.

### Category identifier — unresolved discrepancy ⚠️

**The docs in this repo disagree with each other, and the code follows none of
them cleanly.** This is the one load-bearing assumption the audit could not
settle from the spec alone.

| Source | Category node shape |
|--------|--------------------|
| `openapi.yaml` → `CategoryNode` | `{ rid, label, image, imageUrl, children }` — **no `slug`, no `id`** |
| `CLIENT-DEVELOPER-GUIDE.md` §6.1 | `{ "id": "<slug>", "rid", "label", "subcategories": [...] }` |
| Client code (`ApiCategoryNode`) | Reads `slug` first, then `id`, via `getCategoryNodeId` |

```63:72:src/data/catalogCategories.ts
export function getCategoryNodeId(node: ApiCategoryNode): string {
  return node.slug ?? node.id ?? ''
}
```

`getCategoryNodeId` is the single accessor every lookup goes through, and the
`?? ''` means a node with neither field resolves to an empty id rather than
crashing. **If the server sends neither `slug` nor `id`, every category lookup
misses** and the UI falls back to hardcoded placeholder content — the categories
modal and subcategory filters would show stub entries instead of live data. A
comment in `catalogCategories.ts` records that this exact failure happened
before ("reading `.id` returned `undefined` for all 8 top-level categories and
silently sent the modal down the static-placeholder path").

The client also accepts `subcategories` as an alias for `children`, because the
developer guide documents the former and the OpenAPI spec the latter.

**To resolve:** one live `GET /categories` call. Confirm which of `slug` / `id`
is present, then align `openapi.yaml` and `CLIENT-DEVELOPER-GUIDE.md` to the
answer. Until then the `?? id ?? ''` fallback chain is load-bearing and should
not be pruned.

### API cleanup migration (2026-10-03)

Migrated per `docs/backend-docs/CLIENT-CHANGE-NOTES.md`. The server no longer owns
wording or formatting, so raw values are read and formatted in the client.

| Deprecated wire field | Now read from | Rendered by |
|-----------------------|---------------|-------------|
| product `price`, `originalPrice` | `priceMoney`, `originalPriceMoney` | `formatAmount` |
| detail `priceAmount` + `priceCurrency` | `priceMoney` | `formatAmount` |
| detail `shippingFee` | `shippingFeeMoney` | `formatAmount` |
| cart item `price` (number) | `priceMoney`, `previousPrice` | `formatAmount` |
| order list `total` | `totalMoney` | `formatAmount` |
| review `priceAmount` | `priceMoney` | `formatAmount` |
| product `discount` (`"-18%"`) | `discountPercent: number` | `formatDiscountPercent` |
| product `rating` (`"4.6"`) | `ratingValue: number` | `String(...)` |
| product `delivery` | `deliveryQuote: { free, fee, minDays, maxDays }` | `formatDeliveryQuote` |
| detail `deliveryEstimate` | `deliveryDays: { min, max }` | `formatDeliveryDays` |
| checkout `fee`, `deliveryWindow` | `feeMoney`, `deliveryDays` | `formatAmount` / `formatDeliveryDays` |
| order `statusDateLabel`, `statusBadgeLabel` | `status` + `statusDate` | `getOrderStatusLabel` |
| order `orderTime` | `placedAt` (ISO) | `formatIsoDate` |
| review `date`, waiting `deliveredOn` | `createdAt`, `deliveredAt` | `formatIsoDate` |
| `GET /products/search` | `GET /products?q=` | `catalogApi.searchProducts` |

**Note:** `maxDays` in the `deliveryQuote` row above is the *per-product*
`DeliveryQuote.maxDays` and is correct. It is a different field from the *facet*
array, which is `deliveryDays` — see below.

New fields also wired: `imageUrls`, `variantOptions[].size/color`,
`taxRatePercent`/`priceInclTaxMoney` (typed, not yet displayed), cart
`summary.tax` (shown on the checkout summary), and `order.returnEligibility`
(the return dialog now explains an ineligible order instead of submitting a
request the API would reject with `return_not_allowed`).

All formatting lives in `src/data/format.ts`; `src/api/mappers.ts` normalizes
wire shapes into domain models.

### Catalog destination & delivery (2026-10-03)

The API only computes `deliveryQuote`, `deliveryDays`, `shippingFeeMoney` and
`priceInclTaxMoney` for a **known destination**, supplied as `?country=<ISO
alpha-2>`. Without it every product returns `deliveryQuote: null` and
`facets.delivery: null`. A delivery filter without a destination is rejected
with `422 destination_required`.

`src/hooks/useProductDestination.ts` resolves the country once and shares it:
the signed-in customer's default address country, otherwise
`DEFAULT_DESTINATION_COUNTRY` (`AE`) so signed-out browsing still gets delivery
information. Threaded through `listAllProducts`, `getFeaturedProducts`,
`getNewArrivals`, `getProductDetail`, `getRelatedProducts`, `searchAllProducts`.

**Delivery filter.** `facets.delivery` is a summary — `{ freeCount, deliveryDays[] }` —
not a list of values, so `mapApiProductFacets` builds the panel options from it
(`Free delivery`, `Within N days`), ascending. `deliveryOptionToParams` in
`src/data/deliveryFilter.ts` translates the selected option back into the
`freeDelivery=true` / `maxDeliveryDays=N` params the API accepts. The section
hides entirely when no options are available.

```136:143:src/api/types.ts
export type ApiDeliveryFacet = {
  freeCount: number
  deliveryDays: number[]
}
```

The wire field is `deliveryDays`; the local variable in `buildDeliveryOptions`
stays named `maxDays` because that is what each entry *is* (an upper bound). This
was previously mismatched — see the audit corrections above.

**Note:** the old `delivery=<label>` param the panel previously sent is silently
ignored by the API (total unchanged), so it never actually filtered anything.

### Stock and price changes (2026-10-03)

Cart lines are always priced at today's price, so the cart surfaces movement
before checkout rather than letting `POST /orders` reject the attempt:

- `previousPrice` renders as a "Price changed" strike-through on mobile and desktop rows;
- `stockQuantity` (null = made to order) caps the `QuantityStepper`;
- `available: false` marks the line as no longer orderable;
- `POST /cart/items` and `PATCH /cart/items/:id` return `422 insufficient_stock`
  or `422 currency_mismatch`. `src/data/cartErrors.ts` turns those into a
  shopper-facing message in `ShopContext.cartError`; the cart re-reads the
  authoritative list on rejection so the stepper snaps back.

### Order status and payment status (2026-10-03)

`status` and `paymentStatus` are separate. `status` gained `pending_payment` and
`cancelled` (replacing `pending` and `failed`); `ApiOrderRecord.paymentStatus`
(`unpaid`/`paid`/`failed`/`refunded`) is carried but not yet rendered as its own
badge — only `status` drives the badge label. `pending_payment` uses the server's
documented wording, "Awaiting payment".

### Awaiting Payment tab and Make payment (2026-10-03)

`orderFilterTabs` gained `pending_payment` between **All Orders** and
**Processing**, filtering via `GET /orders?status=pending_payment`. On a
`pending_payment` card **Track order** becomes **Make payment**, because an unpaid
order has nothing to track yet. It calls `POST /checkout/payment-intent` for that
existing `orderId` (`ordersApi.createOrderPaymentIntent`) — the documented retry
path — then hands off to `checkoutUrl`. The pending payment is written to
`sessionStorage` first so the return leg can poll it as usual.

The other-items list in the tracking modal is made of `Link`s to
`getProductPath(line.productId)`.

### Delivery progress shows every stage (2026-10-03)

`buildOrderTimeline(status, events)` always lists **all** stages
(`pending_payment → processing → shipped → delivered`), marking each
`done`/`active`/`upcoming`: green tick for passed, orange ring for current
("In progress"), muted and undated for upcoming. A `cancelled` order marks
nothing. API tracking events match to stages **by label** first (server wording is
authoritative), falling back to index position only when the server returned a
complete timeline, so a date cannot attach to the wrong stage.

### Product attributes (2026-10-03)

List items carry `attributes[]` as `{ key, label, value }`, rendered as
`label: value` in a Specifications section on `ProductDetailView`. The `label`
comes from the API, so renaming an attribute in the admin needs no client change.
Facets also expose `attributes` (`{ name: [values] }`) and `attributeLabels`
(`{ name: "Screen size" }`).

Attribute filters serialize as `?attributes[material]=Leather` via
`toAttributeSearchParams`. **The serializer is implemented and verified against
the live API, but has no caller** — the filter panel exposes only brand, colour,
screen size, price, rating and delivery, so admin-configured attributes are not
selectable. See NOT-INTEGRATED.md.

### Reviews are moderated (2026-10-03)

`POST /reviews` creates the review as `pending`, so the success copy says it is
awaiting approval instead of implying it went live. `GET /reviews/reviewed` items
carry `status`. `404` (line already left the waiting list) and `409 review_exists`
(two submits raced) are translated by `src/data/reviewErrors.ts`.

`GET /reviews/waiting` and `GET /reviews/reviewed` accept **no** query
parameters — the client trims the returned list to 3 and 4 rows respectively
(`sliceReviewItems`). This was previously sending `page`/`limit` that the server
ignored.

### Review payload fields (2026-10-03)

Review rows carry raw values instead of server-formatted strings. Mappers treat
the new field as the source of truth and read the deprecated string only as a
fallback:

| Deprecated string | Raw field | Formatter |
|-------------------|-----------|-----------|
| review `date` | `createdAt` (ISO) | `formatIsoDate` |
| waiting-review `deliveredOn` | `deliveredAt` (ISO) | `formatIsoDate` |
| review `priceAmount` | `priceMoney` (`{ amount, currency }`) | `formatAmount` |

`ReviewedReviewRecord` was an alias of `WaitingReviewRecord`, so the Reviewed tab
could not carry what the shopper wrote. It is now a waiting record plus
`submittedOn`, `status`, `rating`, `title` and `text`, mapped by
`mapApiReviewedReviewSlots`. The Reviewed tab renders an `Awaiting approval` /
`Published` badge from `status`, the review title and body, star rating, and
submission date.

On submit, `AddReviewModal` hands back the values the server accepted plus the
`status` from the response, so the row moves to the Reviewed tab already in the
state the server reported. That row is a preview; the next load replaces it with
the real `createdAt` and `status`.

`RatingStars` lives in `src/components/RatingStars.tsx` so product detail and the
Reviewed row share one implementation.

### Checkout address resolution (2026-10-03)

`POST /orders` requires an `addressId`, and submit-order read it only from
`preview.defaultAddressRid ?? preview.address?.rid`. The preview does not send
`defaultAddressRid` unless the backend has resolved which saved address is
default, and its `address` object is `null` when it cannot — so a shopper who had
already added a default-flagged address was still shown the "add an address"
modal and could never reach payment.

`DefaultAddress` now carries the saved address's `rid`, populated from the
addresses-list entry in `addressRecordToDefaultPreview`. `HomePage` reads it
through the same `useDefaultAddress` hook Checkout and Your Profile use:

```ts
const addressId = preview.defaultAddressRid ?? preview.address?.rid ?? defaultAddress?.rid
```

The addresses **list** stays the source of truth, so this cannot drift from the
profile page. The profile payload's embedded copy carries no rid and is
display-only.

### Address country codes (2026-10-03)

The addresses API stores the country as the ISO 3166-1 alpha-2 **code**
(`"GH"`), not the name, but the form previously submitted the name. The country
dropdown displays the name while storing the code, and fills the country's
dialling prefix into the phone field. `AddressRecord` keeps both `country` (the
code, used as the catalog destination) and `countryName` (for display).

Region and city are sent as `regionId`/`cityId` when they came from a lookup
list, so the backend can match shipping rules by identity rather than name. Typed
values still work, matched by name, with the rid cleared when the country changes.

---

## Cart & wishlist

| Endpoint | UI / behavior |
|----------|----------------|
| `GET /cart` | Cart loaded on app start; badge count in `Nav` |
| `POST /cart/items` | Add to cart from product cards / detail |
| `PATCH /cart/items/:cartItemRid` | Quantity and selection toggles in `CartView` |
| `DELETE /cart/items/:cartItemRid` | Remove single line |
| `DELETE /cart/items` | Delete selected lines |
| `PATCH /cart/items/select-all` | Select all checkbox |
| `POST /cart/items/move-to-wishlist` | Move selected to wishlist |
| `POST /cart/merge` | After login in `SignInModal` |
| `GET /wishlist` | Wishlist page — `WishlistView` |
| `POST /wishlist/:productRid` | Add to wishlist (signed-in) |
| `DELETE /wishlist/:productRid` | Remove from wishlist |

`X-Cart-Id` is persisted from cart responses and sent only while signed out.

**Wired components:** `CartView`, `OrderSummaryPanel`, `ProductDetailView`,
`ProductCard`, `WishlistView`, `ShopContext`

---

## Checkout & orders

| Endpoint | UI / behavior |
|----------|----------------|
| `GET /checkout/preview` | Checkout address, shipping & payment methods — `CheckoutView` |
| `POST /checkout/shipping-quote` | Destination-accurate shipping fee & delivery days — `CheckoutView` |
| `GET /payment-methods/checkout` | Methods without a cart — `getCheckoutPaymentMethods` (public) |
| `POST /orders` | **First** step of submit — creates the order awaiting payment |
| `POST /checkout/payment-intent` | **Second** step — opens payment for that order |
| `GET /payments/:paymentId` | Polled on the return page — `PaymentReturnView` |
| `GET /orders` | Your orders — `YourOrdersView` |
| `GET /orders/buy-again` | "Buy this again" sidebar |

Also implemented: `GET /orders/:rid`, `GET /orders/:rid/tracking`,
`POST /orders/:rid/buy-again`, `POST /orders/:rid/return`,
`POST /orders/:rid/cancel` (unpaid orders only — **Cancel order** on `YourOrdersView`).

### Shipping quote (re-quoted on address change)

`GET /checkout/preview` prices the cart in the **store currency** when it has no
destination, so its shipping block can quote a fee for the wrong country.
`POST /checkout/shipping-quote` prices a *specific* destination and is now called
whenever the shopper's address changes.

- **Trigger** — a `useEffect` in `CheckoutView` keyed on the default address's
  `rid`. Changing the address resolves to a different rid, which re-quotes. The
  preview still seeds the panel on mount, so there is never an empty shipping
  block.
- **Request** — `getShippingQuote(rid)` posts `{ addressRid }`. The function also
  accepts a raw address object for a **guest** with no saved address, where the
  spec requires `country` in place of `addressRid`; no UI calls that form yet,
  since checkout itself requires auth.
- **Response** — `feeMoney` (`Money`), `deliveryDays` (`{min, max}`, nullable) and
  `courierLabel` (nullable). The deprecated `fee` / `deliveryWindow` strings are
  never used; `mapShippingQuote` formats the structured fields.
- **Staleness** — `isQuotingShipping` is **derived** by comparing the address rid
  against the rid the on-screen figures were quoted for, rather than toggled in
  the effect. This avoids a cascading render and covers the gap before the
  re-quote resolves. While true, the panel keeps the previous figures and shows
  "Updating for your address…".
- **Failure** — a rejected quote leaves the preview's figures in place. The shopper
  still sees a price rather than a blank panel.

The response's **`summary`** (`CartSummary`, cart totals including tax) is typed
and available on `ShippingQuote`, but `OrderSummaryPanel` still renders its own
totals. Surfacing it would mean the totals and the shipping fee come from the
same call.

### Payment flow (order-first)

Checkout is reversed: the order is created **before** payment, so totals are fixed
at current prices and stock is held, and the provider is opened for exactly that
order total. The client never collects card details.

1. **Place order** — `handleSubmitOrder` resolves the address from
   `GET /checkout/preview`, then `POST /orders` with `{ addressId, cartItemIds }`.
   `paymentToken` is gone. Requires auth. The ordered lines leave the cart at this
   point, so the cart is refreshed before the redirect. A blocking overlay covers
   the page from here until the browser reaches the provider — see
   [Redirect overlay](#redirect-overlay-the-empty-cart-flash) below for why that is
   required and not cosmetic.
2. **Open payment** — `POST /checkout/payment-intent` with
   `{ orderId, paymentMethodId }` returns `checkoutUrl`, `paymentRid`, `provider`,
   `amount`, and echoes `paymentMethodId`. These are written to `sessionStorage`
   (`api/pendingPayment.ts`) because the handoff is a full page load that discards
   React state. The browser then navigates to `checkoutUrl`.
3. **Return** — `/checkout/return` and `/checkout/cancel`. Only
   `?reference=<payment rid>` is trusted; provider params like `session_id` are
   ignored.
4. **Confirm** — `PaymentReturnView` polls `GET /payments/:reference` every 2s
   (max 10 attempts) until the payment settles. 401/404 stop polling immediately.
   A cancel or missing reference resolves without a request. `pending` is **not**
   a failure: approval-style methods (PayPal, Tabby, Tamara) approve first and
   capture after, so if the poll budget runs out while still `pending` the page
   shows a neutral "still processing" state rather than an error.
5. **Reconcile** — on `succeeded` there is nothing left to place: the order already
   exists. The stored pending payment is consumed once (guarded on the payment rid)
   so a re-render or repeat visit cannot run it twice, then the cart is cleared and
   `OrderCompletedView` is shown.

### Order confirmation page (no placeholder data)

The confirmation page used to render hardcoded values for everything the shopper
cares about: a sample reference (`#HCO5241124542`), a fixed delivery window
(`24-36 May`) and a contact/address taken from the mock profile in
`data/profile.ts`. None of it came from the order, so the page described an order
that never existed.

Three sources now drive it, in order of authority:

| Field | Source | Why |
| --- | --- | --- |
| Shipping address | `GET /orders/:rid` → `address` | The only frozen snapshot of where the order actually ships to. The account's current default may have changed since. |
| Order reference | Order detail, falling back to the placement response | Same value either way; the detail is read fresh. |
| Estimated delivery | Order detail, falling back to the placement response | Frozen wording — see below. |

`POST /orders` does **not** echo the shipping address back, so the page re-reads
the order on mount to obtain it. That required `orderId` to be carried through to
the page, which it previously was not — `lastOrder` held only the reference and
the delivery wording, so the address was unavailable and had to be faked.

**`estimatedDelivery` is never reformatted.** The API types it as
`FrozenDeliveryWording`, documented as free text that must be *displayed as-is
and never parsed*, and it is `nullable` — an order with no recorded window sends
`null`, not an empty string. It is rendered verbatim and omitted when null. This
also required widening `estimatedDelivery` to `string | null` in
`PlaceOrderResponse`, `PendingPayment` and `LastOrder`, since it had been typed
as a plain `string`.

`lastOrder` is now mirrored into `sessionStorage` (`api/lastOrder.ts`).
`/order-complete` is a real, directly reachable route, but the order it describes
only exists in recent history — so a page refresh previously wiped the page's
order details, which the placeholders had been masking.

Two adjacent bugs fixed alongside it:

- `YourOrdersView` passed `order.statusDateLabel` (the date the order's **status**
  last changed) as `estimatedDelivery` when paying an unpaid order, so the
  confirmation page showed a status date as a delivery estimate. It now reads both
  values from `GET /orders/:rid`.
- The copy in `orderCompletedCopy` had typos ("Thank your for your order",
  "oder has been recieved") and the reference/window placeholders. Both placeholders
  are gone rather than being left as fallbacks — a fallback sample is shown as if
  it were real, which is the exact bug being fixed. `checkoutAddress` was deleted
  entirely, as was its now-unused `defaultAddress` import.

### Redirect overlay (the empty-cart flash)

Order-first checkout creates the order **before** payment, so the ordered lines
leave the cart while payment is still being opened. `HomePage` had a guard that
redirects `/checkout` → `/cart` whenever the cart is empty, and that guard fired
**mid-purchase**: the shopper clicked *Submit order*, the cart emptied, and they
were bounced to **"Your cart is empty"** while `POST /checkout/payment-intent` was
still running and before the browser left for the provider.

Two changes fix it.

**`PaymentRedirectOverlay`** covers the page for the whole window, naming the step
in progress (*Placing your order…* → *Opening secure payment…*) so the wait is
explained. It is `role="status"` with `aria-live="polite"` and cannot be dismissed;
the page underneath is mid-transition and is not safe to interact with. It is
deliberately **not** cleared before `window.location.href` — clearing it first
would briefly reveal the emptied cart before the browser leaves.

**The redirect guard is skipped while the handoff is in flight.** `paymentRedirectStep`
being non-null is the signal, so the overlay and the guard cannot disagree.

### Payment failure modal

A payment failure is shown in `PaymentErrorModal` rather than the inline banner,
because the shopper is mid-purchase and a small banner is easy to miss.

The two failures need **different escapes**, because order-first checkout makes
them genuinely different states:

| State | Cart | What the shopper can do | Offered |
|-------|------|-------------------------|---------|
| Order never created | Untouched | Resubmit checkout — a real retry | **Try again** (resets the idempotency key) |
| Order created, payment not opened | **Empty** | Pay the existing order | **Pay for this order** → Your Orders |

**Retry is deliberately not offered once the order exists.** The lines have left
the cart, so resubmitting would place a *duplicate* order or do nothing. The order
is `pending_payment` and retriable from Your Orders via **Make payment**, which
uses a fresh idempotency key (`createStandalonePaymentIntentKey`) since that body
differs from the checkout attempt's.

Two related guards keep the failure from dumping the shopper back on the empty
cart:

- the redirect guard is also skipped while `paymentError.isOrderPlaced`, and
- dismissing the modal in that state navigates to the unpaid order instead of
  closing onto a dead-end checkout page. The secondary button is labelled
  **Go to my orders** rather than **Close** for the same reason.

`price_changed` conflicts and payment-method rejections are **not** routed to this
modal. A price conflict is a decision the shopper must make, and a rejected method
is fixed by picking a different one — both stay inline on the checkout page, where
the thing they act on lives.

### Checkout payment methods

The method list is **backend-driven** — admin settings, not a client constant.
`data/checkoutPaymentMethods.ts` owns the mapping and brand artwork. The fixed
six-method list that used to live in `data/cart.ts` was **removed**.

| Source | When |
|--------|------|
| `GET /checkout/preview` → `paymentMethods[]` | Baseline, loaded with the preview |
| `GET /payment-methods/checkout?currency=&country=` | Merged on top, with the destination's own currency. Public, no auth. `currency` alone when the destination is unknown, so the backend withholds country-scoped methods rather than showing one that cannot pay |

**Destination currency (mobile money).** The preview prices the cart in the store
currency (`AED`) when it has no destination, and reports methods only for that
currency — which hid every currency-scoped rail, since mobile money is configured
for `GHS`/`GH`. `getCheckoutCurrency` maps the default address's country to the
currency the order will be billed in (`GH` → `GHS`, else `AED`).
`mergeCheckoutPaymentMethods` adds those methods to the preview's, keyed by the id
sent as `paymentMethodId`, so neither list can drop a method the other had.

Each entry is `{ id, rid, code, label, icon, iconUrl }`.

- **`paymentMethodId`** — the shopper's pick, sent as the backend's `rid` when
  present else `code`. Both accepted by the backend. Reported upward from
  `CheckoutView` via `onPaymentMethodChange` and held in `HomePage`.
- **Artwork** — `iconUrl` (uploaded path or absolute URL) is used as-is. Otherwise
  `icon` or `code` is a short artwork key mapped to local brand assets. A bare key
  is **never** turned into a URL: an unrecognised key renders the label with no
  image rather than a broken one, so a newly configured method degrades cleanly.
- **Card rails** (`card`, `visa`, `mastercard`) get card-specific redirect copy and
  show Visa as a secondary mark next to Mastercard.
- **Empty list is respected.** The backend withholds methods that cannot serve the
  order's currency or destination; the page says so rather than substituting a
  local default that would fail on submit.

**Rejections** (`isPaymentMethodRejection`) recover by asking for a different
method. All leave the order awaiting payment, so the shopper retries with the same
idempotency key — the same decision, not a new one. The selection is cleared so the
list reloads and the failed method cannot be silently resubmitted.

| Code | Status | Meaning |
|------|--------|---------|
| `payment_method_not_found` | 404 | Unknown id (admin removed it, or a stale list) |
| `payment_method_unavailable` | 422 | Method does not serve the order currency |
| `payment_method_declined` | 422 | Provider declined this shopper (Tabby rejects here) |

### Mobile-money networks

`GET /payment-methods/networks` returns `{ networks: [{ id, label }] }` — a fixed,
backend-owned list. It is public and cheap, so `usePaymentNetworks` reads it once
per mount and shares it.

- **`id` is an enum key, not a resource rid** (`mtn`, `vodafone_cash`). The spec is
  explicit that this `id` is one of the few non-resource identifiers. It is the
  value to submit and to match on; `label` is what to show.
- **Submission vs. display** — `AddPaymentMethodModal` stores the `id` in
  `<select value>`, so the saved method carries the enum key.
  `getPaymentNetworkLabel` (`src/data/paymentNetworks.ts`) resolves that key back to
  the API's label for `PaymentMethodsPanel` and `YourOrdersView`, instead of showing
  `vodafone_cash` to a shopper. It normalises case, spaces, `_` and `-`, so a
  deployment echoing the label still matches, and falls back to the raw value for a
  network no longer in the list.
- **The hardcoded list was removed.** `mobileMoneyNetworks` (`['MTN', 'Vodafone
  Cash', 'AirtelTigo Money']`) in `data/paymentMethods.ts` is deleted, so an admin
  adding a network no longer needs a client change.
- **Fallback** — on failure the hook keeps a small built-in list. Blocking
  payment-method entry because a reference list would not load is a worse outcome
  than showing the three networks the store has always shown.

> **Not yet reachable.** `AddPaymentMethodModal` has no caller, so the selector is
> wired but not mounted. The API exposes no create/update endpoint for saved payment
> methods (cards are tokenized provider-side and only listed, defaulted, deleted),
> so there is no supported way to add a saved mobile-money method through this
> client today. See
> [NOT-INTEGRATED.md](./NOT-INTEGRATED.md#payment-methods).

### Idempotency-Key

`POST /orders` and `POST /checkout/payment-intent` both require
`Idempotency-Key: <uuid>` (missing header → `428 idempotency_key_required`). The
server keeps **one idempotency record per key** and rejects a key replayed with a
*different* body as `422 idempotency_key_reused`.

**Each endpoint gets its own key** (`src/api/idempotency.ts`). A single shared key
looks correct — one click, one key — but the two calls never carry the same body
(`{addressId, cartItemIds}` then `{orderId, paymentMethodId}`), so the second would
always be rejected. Within one endpoint the key **reuses** across retries:

- a retry after a timeout or network error **reuses** the key, so the stored response
  is replayed instead of creating a duplicate order;
- the payment-intent key rotates when `paymentMethodId` changes, because choosing a
  different method after a decline is a new request with a new body;
- acknowledging a `price_changed` conflict **resets** both keys, because agreeing to
  a new price is a new decision rather than a retry of the same one.

`createStandalonePaymentIntentKey()` covers "Make payment" on an already-placed order.

### Order-time conflicts

`POST /orders` returns `409` for several expected conditions. All mean the order was
**not** created and the cart is untouched. `src/data/orderConflicts.ts` normalises
them into a shopper-facing message:

| Code | Shown as |
|---|---|
| `price_changed` | Old and new price per line, with an "Accept new prices" action. The conflict records that the shopper has now seen the new price, so resubmitting succeeds. |
| `insufficient_stock` | Remaining quantity per variant. |
| `item_unavailable` | Tells the shopper to remove the lines. |
| `cart_changed` | Plain retry. |
| `currency_mismatch` | Not retryable — explains the mixed currencies. |

Unpaid orders are cancelled after 60 minutes
(`PAYMENTS_ORDER_PAYMENT_WINDOW_MINUTES`), and the window restarts on each payment
attempt. A cancelled order returns `409 order_not_payable` on payment-intent, which
sends the shopper back to place a new order.

### Cart identity

`X-Cart-Id` is **guest-only**. `api/client.ts` omits it whenever a Bearer token is
present, because the server resolves the user's cart from the token and ignores the
header. Two endpoints opt back in via `guestCartId: true` because they deliberately
consume the guest cart: `POST /cart/merge` and `POST /orders`.

**Requirements:** user must be signed in to start payment; at least one cart line
must be selected; a default address must exist.

---

## Account

| Endpoint | UI / behavior |
|----------|----------------|
| `GET /addresses` | Addresses list on load — `AddressesPanel` |
| `GET /payment-methods` | Saved payment methods — `PaymentMethodsPanel` |
| `GET /browsing-history` | Browsing history — `BrowsingHistoryPanel` |
| `GET /notifications/settings` | Notification toggles — `NotificationsPanel` |
| `PATCH /notifications/settings/:id` | Toggle promotions / order updates |
| `GET /users/me/profile`, `PATCH /users/me/profile` | Your Profile — `ProfilePanel` |
| `PUT /users/me/country` | Country of residence — `ProfilePanel` → Personal Information |
| `GET /users/me/security` | Account & Security tab — email, phone, 2FA flag |
| `PATCH /users/me/email`, `PATCH /users/me/phone`, `PATCH /users/me/password` | Security action modals |
| `POST /users/me/2fa/enable`, `POST /users/me/2fa/disable` | Two-factor toggle |
| `DELETE /users/me` | Delete account (signs out, returns home) |
| `GET /reviews/waiting`, `GET /reviews/reviewed`, `POST /reviews` | Reviews — `ReviewsPanel`, `AddReviewModal` |

Address sub-resources (`POST /addresses`, `PATCH`/`DELETE /addresses/:rid`,
`PATCH /addresses/:rid/default`, `POST /addresses/:rid/duplicate`) are all wired.
History recording (`POST /browsing-history`), row deletion
(`DELETE /browsing-history`), and clear-all (`DELETE /browsing-history/all`) are wired.

**Payment methods are read-and-manage only.** The API removed `POST /payment-methods`
and `PATCH /payment-methods/:id`, because clients never send card data — only
provider tokens and masked details are stored. The add/edit UI was removed; a saved
method can be set as default (`PATCH /payment-methods/:id/default`) or deleted
(`DELETE /payment-methods/:id`). Failures roll the optimistic update back and
surface the server's message.

**Notes**
- `GET`/`PATCH /users/me/profile` return the profile document at the **top level** on
  the live backend, not nested under `profile`, so `getProfile`/`updateProfile`
  normalise both shapes to `{ profile, defaultAddress }`.
- The default address is read from the Addresses list (the entry flagged `isDefault`)
  through `useDefaultAddress`, shared by Your Profile and Checkout so they cannot
  drift. The profile payload's embedded copy is a fallback for when no list entry
  carries the flag.
- Address lookups are keyed differently: regions by country **rid/code**, cities by
  region **rid**.
- **Country of residence** (`PUT /users/me/country` with `{ preferredCountry }`) is a
  profile setting separate from the shipping address. The API accepts an ISO code,
  country rid, or name, or `null` to clear. The profile page loads options from
  `GET /addresses/lookup/countries` and saves the selected row's ISO code when
  available. Catalog reads (`useProductDestination`) send `?country=` in this order:
  default address country first, then preferred country, then omit the param when
  signed out or unset. Changing residence or the default address broadcasts
  `notifyPreferredCountryChanged()` so the catalog refetches without a full reload.

---

## CMS & legal pages

| Endpoint | CMS slug | Page |
|----------|----------|------|
| `GET /content/pages/:slug` | `privacy-policy` | Privacy Policy |
| `GET /content/pages/:slug` | `warranty` | Warranty |
| `GET /content/pages/:slug` | `shipping-delivery` | Shipping & Delivery |
| `GET /content/pages/:slug` | `return-refund` | Return & Refund |
| `GET /content/pages/:slug` | `secure-payments` | Secure Payments |
| `GET /content/pages/:slug` | `intellectual-property` | Intellectual Property |
| `GET /content/pages/:slug` | `terms-of-use` | Terms of Use |

**Hook:** `useCmsPage(slug, fallback)` — uses API content when available, otherwise
static copy from `src/data/*`.

`GET /content/home` and `GET /content/footer` are implemented but **not called** —
`HeroSection`, promo blocks and the footer columns remain static. See
NOT-INTEGRATED.md.

---

## Public forms

| Endpoint | UI / behavior |
|----------|----------------|
| `POST /newsletter/subscribe` | Footer email subscribe — `Footer` |

`POST /newsletter/unsubscribe`, `POST /partnerships/inquiries`,
`POST /quotations` and `POST /support/agent-requests` are implemented but have no
UI — their footer links are inert.

---

## About page redesign (2026-10-03)

`AboutPageContent` was rebuilt as an editorial layout in the style of
`ebayinc.com` — oversized hero headline over a full-bleed image, a lede-style intro,
a numbers band, alternating image/copy splits, a values grid and a departments band
— keeping **every** line of the existing copy (`aboutIntroParagraphs`,
`aboutVisionText`, `aboutValues`, `aboutCommitmentParagraphs`). Only two short
strings were added for the hero: `aboutHeroTitle` and `aboutHeroSubtitle`.

| Decision | Reason |
|----------|--------|
| **Numbers band is derived, not written** | Reads `allProducts.length`, `categories.length` and the subcategory count from `CatalogContext`, so it cannot drift from the store. Renders **nothing** until `isReady`, because a "0 products" figure would be false and a hardcoded one would rot. |
| **One reusable image** | `images.about.placeholder` is used in both split sections until final photography lands. Swapping it is a one-line change in `src/assets/images.ts`. |
| **Departments band is a route, not decoration** | Each category links to `getCategoryPath(categoryId)` via the new `onGoToCategory` prop, so About is a way into the catalog rather than a dead end. |

The page still uses **static copy** — `useCmsPage('about')` is not applied, unlike
the legal pages.

---

## Route protection

`src/components/RequireAuth.tsx` gates signed-in-only surfaces. The account routes
(`/account/:section`) are wrapped in it, so a signed-out visitor hitting those URLs
directly is redirected home and prompted via the sign-in modal.

- Holds a `ListingLoader` while `AuthProvider` restores the session from storage, so a
  page refresh does not bounce a signed-in user out before they are resolved.
- Calls `requestSignIn()` when blocked, which the `Nav` watches to open the sign-in
  modal (same mechanism as the wishlist heart and cart checkout).
- Re-evaluates on session change, so signing out while on an account page ejects
  immediately rather than leaving stale private panels on screen.

This is a **UX guard, not a security boundary** — the backend authorises its own
endpoints, and that server-side check is what actually protects the data.

---

## How to run

```bash
cp .env.example .env   # set VITE_API_BASE_URL if needed
npm install
npm run dev
```

Sign in with the demo account to test cart merge, wishlist, checkout, and account
sections against the live API.

---

## Known doc discrepancies

Documents in this repo that contradict each other or the code. Listed so they are
not mistaken for verified fact.

| Discrepancy | Detail |
|---|---|
| **Category identifier** | `openapi.yaml` has no `slug`/`id` on `CategoryNode`; `CLIENT-DEVELOPER-GUIDE.md` says `id`; the client prefers `slug`. Unresolved — see the Catalog section above. **Needs one live `GET /categories`.** |
| **`catalogCategories.ts` comment (line 66)** | States "The API sends the identifier as `slug`" as settled fact, but that is the claim under question — `openapi.yaml` has no `slug` on `CategoryNode`. The comment should be softened to match reality once the live check settles it. The `slug ?? id ?? ''` fallback is the load-bearing part; the comment's certainty is not. |
| **`FRONTEND-API-CHANGES.md` §3 and §6** | Describes `POST /checkout/payment-intent` with an empty body and `POST /orders` carrying `paymentToken`. Both are superseded by order-first checkout: payment-intent now takes `{orderId}` and `POST /orders` takes `{addressId, cartItemIds}` with no `paymentToken`. The API-change doc predates the reversal. |
| **`FRONTEND-API-CHANGES.md` "Unchanged" note** | Says preview still returns a static `paymentMethods` display list. The preview list is now merged with `GET /payment-methods/checkout`, which is currency- and destination-scoped. |
| **`API.md` vs `openapi.yaml`** | `openapi.yaml` is the machine-readable source of truth; `API.md` is the human companion. Where they differ on field names, `openapi.yaml` was treated as authoritative in the audit. |