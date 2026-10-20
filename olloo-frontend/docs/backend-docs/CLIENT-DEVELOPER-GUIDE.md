# HandCO API: Client Developer Guide

This guide is for frontend and mobile engineers integrating with the HandCO customer API. It explains conventions, auth, guest carts, checkout, and how to use the Postman package that ships with this document.

You should receive a `postman/` folder that contains this guide plus the collection, environment, and visual Flows. Treat that folder as the source of truth for runnable examples.

---

## 1. Package contents

| File / folder | Purpose |
|---------------|---------|
| [CLIENT-DEVELOPER-GUIDE.md](./CLIENT-DEVELOPER-GUIDE.md) | This document |
| [README.md](./README.md) | Short import / run notes for Postman |
| [HandCO-API.postman_collection.json](./HandCO-API.postman_collection.json) | Full API collection (every customer endpoint) |
| [HandCO.local.postman_environment.json](./HandCO.local.postman_environment.json) | Environment variables (`baseUrl`, tokens, rids) |
| [flows/](./flows/) | Visual [Postman Flows](https://www.postman.com/product/flows/) canvases for end-to-end journeys |

Inside the collection you will also find a **Flows** folder with the same journeys as sequential requests (Collection Runner). Prefer the visual `.postman_flow.json` files when you want a diagram you can step through.

---

## 2. Quick start with Postman

### 2.1 What to Import (and what not to)

In Postman → **Import**, select **only**:

1. `HandCO-API.postman_collection.json`
2. `HandCO.local.postman_environment.json`

Do **not** add files from `flows/` to Import. Visual flow files (`.postman_flow.json`) are not collections. Postman will mis-detect them as “DHC Project”, show **Error while importing DHC Project: No requests found**, and stall at **0 of N elements**. Cancel that import if it appears.

| Artifact | How to load it |
|----------|----------------|
| Collection + environment | **Import** |
| Visual canvases in `flows/` | **Flows → Local View** (desktop app), or deep link (below) |
| Sequential journeys | Already inside the collection under folder **Flows** (no extra import) |

### 2.2 First requests

1. Select environment **HandCO Local** in the top-right environment picker.
2. Confirm `baseUrl` points at the API you were given (see below).
3. Open **Auth → Login**, send the request with the demo credentials (or your own).
4. Confirm `accessToken` is now set under **Environments → HandCO Local**.
5. Call **Auth → Me**. It should return the current user.

### Base URLs

| Variable | Meaning | Example |
|----------|---------|---------|
| `baseUrl` | Customer API root including `/api/v1` | `https://handco.example.com/api/v1` or `http://127.0.0.1:8000/api/v1` |
| `webhookBaseUrl` | App origin **without** `/api/v1` (payment webhooks only) | `https://handco.example.com` |

All customer JSON endpoints live under `{{baseUrl}}/...`.

Webhooks are **not** client features. The **Webhooks** folder is for backend / QA testing only. Do not call webhook URLs from the storefront.

### Demo account (seeded environments)

| Email | Password |
|-------|----------|
| `demo@handco.test` | `password` |

---

## 3. Core conventions

### 3.1 Identifiers are rids

Every client-facing record uses a stable string **rid** (resource id). Never send or store numeric database primary keys.

Examples of rid-shaped values:

- Product: `aerosmart-earbuds` or a generated 12-character rid
- Cart / cart line / order / address / payment: opaque strings such as `k3m9xq2ab7cd`

In JSON, many payloads expose both `id` and `rid` where `id` is **also the rid string** (not an integer). Prefer reading `rid`. When a request field is named `productId`, `addressId`, or `cartItemIds`, the value is still a **rid string**.

Path params in Postman use variables like `{{productRid}}`, `{{orderRid}}`, `{{addressRid}}`. Collection test scripts often capture these for you after list / create calls.

### 3.2 Authentication header

Protected routes require:

```http
Authorization: Bearer <accessToken>
Accept: application/json
Content-Type: application/json
```

The collection auth is configured at collection level as Bearer `{{accessToken}}`. Individual public requests override auth as needed.

### 3.3 Money

Structured money objects look like:

```json
{ "amount": 179.0, "currency": "AED" }
```

Amounts are major units (decimal AED), not fils. Some list UIs also include display strings such as `"AED 179.00"` (`price`). Prefer `priceMoney` / structured money fields for calculations.

### 3.4 Pagination

List endpoints typically accept:

| Query | Default | Notes |
|-------|---------|-------|
| `page` | `1` | 1-based |
| `limit` | endpoint-specific | Catalog default is 24 (max 100) |

Product lists return:

```json
{
  "items": [ /* product cards */ ],
  "total": 120,
  "page": 1,
  "limit": 20,
  "facets": {
    "brands": [],
    "colors": [],
    "deliveryOptions": [],
    "screenSizes": []
  }
}
```

Order lists return `{ "orders": [...], "total": N }` with `page` / `limit` query params.

### 3.5 Errors

Application errors:

```json
{
  "error": {
    "code": "cart_empty",
    "message": "Select at least one cart item before payment.",
    "details": {}
  }
}
```

`details` is optional. Laravel validation failures may instead return the framework shape (`message` + `errors` map) with HTTP `422`. Treat both as client-visible failures.

Common HTTP statuses: `200` / `201` success, `401` unauthenticated, `404` missing resource, `422` validation / business rule.

### 3.6 Content type

Send JSON bodies with `Content-Type: application/json` and always send `Accept: application/json`.

---

## 4. Auth model

Postman folder: **Auth**

### 4.1 Tokens

Login, register, OAuth, and refresh return:

```json
{
  "user": {
    "rid": "...",
    "displayName": "Demo",
    "fullName": "Demo Customer",
    "email": "demo@handco.test"
  },
  "accessToken": "...",
  "refreshToken": "..."
}
```

Client responsibilities:

1. Persist `accessToken` and `refreshToken` securely (memory + secure storage; never `localStorage` for long-lived refresh on web if you can avoid it).
2. Attach `accessToken` on every protected request.
3. On `401`, call `POST /auth/refresh` with `{ "refreshToken": "..." }`, replace both tokens, retry the original request once.
4. On refresh failure, clear session and show sign-in.

`GET /auth/me` returns `{ "user": { ... } }` and is the session bootstrap call after cold start if you already have a token.

`POST /auth/logout` revokes the current access token. Clear local tokens afterward.

### 4.2 Email-first sign-in

Recommended UX (matches **Flows → 01 Auth lifecycle**):

1. `POST /auth/check-email` with `{ "email": "..." }`  
   Response: `{ "exists": true|false, "nextStep": "password"|"register" }`
2. If `password` → `POST /auth/login`
3. If `register` → `POST /auth/register` with:

```json
{
  "email": "new@example.com",
  "password": "secret-password",
  "password_confirmation": "secret-password",
  "fullName": "Ada Lovelace",
  "displayName": "Ada"
}
```

### 4.3 OAuth

`POST /auth/oauth/{provider}` where `provider` is `google`, `facebook`, or `apple`.

```json
{
  "idToken": "<provider token>",
  "email": "optional@example.com",
  "fullName": "Optional Name"
}
```

Response shape matches login. Login / register / OAuth also attempt to merge any guest cart present on the request (see Guest cart).

### 4.4 Password reset

1. `POST /auth/forgot-password` `{ "email": "..." }` (always returns a generic success message)
2. User opens email link → your app collects new password
3. `POST /auth/reset-password` with `email`, `token`, `password`, `password_confirmation`

### 4.5 Postman tip: empty Bearer token

Environment variables shadow collection variables. Login scripts write `accessToken` to **both**. If **Me** still sends an empty Bearer token:

1. Confirm **HandCO Local** is selected.
2. Open the environment and verify `accessToken` is non-empty after Login.
3. Re-run Login from the collection (not a stale duplicate request).

---

## 5. Guest cart and `X-Cart-Id`

Postman folder: **Cart**

Guest shoppers get a cart without signing in. The API identifies that cart with:

| Mechanism | Name | Notes |
|-----------|------|-------|
| Request header | `X-Cart-Id: <cartRid>` | Preferred for SPAs / mobile |
| Cookie | `cart_id=<cartRid>` | Set automatically on cart responses (browser clients) |

### Client rules

1. On first cart mutation (for example add item) with no cart yet, omit `X-Cart-Id` (or send empty). The response includes header `X-Cart-Id` with the new rid.
2. Persist that rid (local storage / secure storage) and send it on every subsequent cart / checkout call.
3. After login / register / OAuth, call `POST /cart/merge` while still sending the guest `X-Cart-Id` **and** the Bearer token. The server merges guest lines into the user cart. Login already attempts a merge if the header/cookie is present; calling merge explicitly after login is still safe and matches **Flow 03**.
4. Cart JSON body does not always include the cart rid. Always read `X-Cart-Id` from the response headers.

### Cart payload shape

```json
{
  "items": [
    {
      "id": "<cartItemRid>",
      "rid": "<cartItemRid>",
      "name": "AeroSmart Earbuds",
      "variant": "Standard",
      "image": "https://...",
      "currency": "AED",
      "price": 179.0,
      "quantity": 1,
      "selected": true,
      "productRid": "<productRid>"
    }
  ],
  "summary": {
    "itemsTotal": { "amount": 199.0, "currency": "AED" },
    "itemsDiscount": { "amount": -20.0, "currency": "AED" },
    "subtotal": { "amount": 179.0, "currency": "AED" },
    "shipping": { "amount": 15.0, "currency": "AED" },
    "total": { "amount": 194.0, "currency": "AED" }
  }
}
```

### Important cart endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `GET` | `/cart` | Optional | Current cart |
| `POST` | `/cart/items` | Optional | Body: `{ "productId", "variantId?", "quantity?" }` |
| `PATCH` | `/cart/items/:cartItemRid` | Optional | `{ "quantity"?, "selected"? }` |
| `DELETE` | `/cart/items/:cartItemRid` | Optional | Remove one line |
| `DELETE` | `/cart/items` | Optional | Remove all **selected** lines |
| `PATCH` | `/cart/items/select-all` | Optional | `{ "selected": true\|false }` |
| `POST` | `/cart/items/move-to-wishlist` | Required | Moves selected lines |
| `POST` | `/cart/merge` | Required | Merge guest cart after login |

Checkout totals only include lines with `selected: true`.

---

## 6. Catalog, search, and home content

Postman folders: **Catalog**, **Search**, **CMS**

### 6.1 Categories

- `GET /categories` → `{ "categories": [ { "id": "<slug>", "rid", "label", "subcategories": [...] } ] }`
- `GET /categories/:categoryId/panel` → modal panel payload. `:categoryId` may be the category **slug** (for example `electronics`) or rid. Seed default slug used in Postman: `electronics` (`{{categoryRid}}` in the environment may hold that slug).

Special listing filters (not real category rows): `all-categories`, `featured`, `new-releases`.

### 6.2 Products

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/products` | Filtered listing |
| `GET` | `/products/featured` | Home featured strip |
| `GET` | `/products/new-arrivals` | Home new arrivals |
| `GET` | `/products/:productRid` | Detail |
| `GET` | `/products/:productRid/related` | Related |
| `GET` | `/products/:productRid/reviews` | Reviews (paginated) |
| `GET` | `/products/recommendations` | Recommendations |
| `GET` | `/products/search` | Search (`q` required) |
| `GET` | `/search/suggestions` | Typeahead (`q`) |

Common query params for listings / search:

`categoryId`, `subcategory`, `q`, `minPrice`, `maxPrice`, `minRating`, `delivery`, `brand`, `color`, `screenSize`, `sort`, `page`, `limit`

Product card fields include `rid` / `id` (both rid strings), display `price`, structured `priceMoney`, `liked` (boolean or null), and facet attributes.

Detail response wraps:

```json
{
  "product": { /* card */ },
  "images": ["..."],
  "ratingValue": 4.5,
  "reviewCount": 12,
  "soldCount": 80,
  "variants": [ { "rid", "name", "sku", "priceMoney", "isDefault" } ],
  "descriptionLines": ["..."],
  "shippingFee": "AED 15.00",
  "deliveryEstimate": "..."
}
```

### 6.3 CMS

Public content (no auth):

- `GET /content/home`
- `GET /content/footer`
- `GET /content/pages/:slug` (examples: `privacy-policy`, `about`)

Use these for marketing / legal pages instead of hardcoding copy when the CMS is populated.

---

## 7. Wishlist, reviews, history, notifications

| Area | Folder | Auth | Notes |
|------|--------|------|-------|
| Wishlist | **Wishlist** | Yes | Add/remove by `productRid` |
| Reviews | **Reviews** | Yes | `waiting` → pending review slots; `POST /reviews` submits |
| Browsing history | **Browsing History** | Mixed | `POST /browsing-history` can record while browsing; list/delete require auth |
| Notifications | **Notifications** | Yes | Toggle settings (`promotions`, `orderUpdates`) |

When authenticated, product cards may include `liked: true|false` based on wishlist membership.

---

## 8. Account: profile, addresses, payment methods

Postman folders: **Profile**, **Addresses**, **Payment Methods**

### 8.1 Profile and security

All under `/users/me/...` and require auth:

- Profile get / patch
- Security summary
- Email / phone / password updates
- 2FA enable / disable
- Account delete

### 8.2 Addresses

Lookups are public (for forms):

- `GET /addresses/lookup/countries`
- `GET /addresses/lookup/regions?country=AE`
- `GET /addresses/lookup/cities?region={{regionRid}}`

CRUD requires auth. Create body example (see collection **Addresses → Create address**):

```json
{
  "country": "AE",
  "firstName": "Demo",
  "lastName": "Customer",
  "phoneCountryCode": "+971",
  "phoneNumber": "501234567",
  "addressLine": "Hse 8 M Street",
  "region": "Dubai",
  "city": "Dubai",
  "isDefault": true
}
```

Response includes `rid`. Use that rid as `addressId` / `addressRid` in checkout and order placement.

### 8.3 Saved payment methods

`GET /payment-methods/networks` is public. CRUD of saved cards requires auth. Checkout also supports wallet method ids such as `card`, `apple_pay`, `google_pay`, `paypal`, `tabby`, `tamara` (these are method identifiers, not rids).

---

## 9. Checkout and orders

Postman folders: **Checkout**, **Orders**  
Recommended walkthrough: visual flow `04-checkout-happy-path.postman_flow.json` or collection **Flows → 04 Checkout happy path**.

### 9.1 Happy path (client)

1. Ensure cart has selected lines (`selected: true`).
2. User is authenticated (or you accept guest email only through payment-intent; placing an order requires auth).
3. Create or select a shipping address (`addressRid`).
4. `GET /checkout/preview` with `X-Cart-Id` (+ Bearer if logged in) → selected items, default address preview, shipping, payment method list, summary.
5. `POST /checkout/shipping-quote` with either `addressRid` **or** inline address fields.
6. `POST /checkout/payment-intent`:

```json
{
  "callbackUrl": "https://your.app/checkout/return",
  "cancelUrl": "https://your.app/checkout/cancel",
  "email": "demo@handco.test",
  "paymentMethodId": "card"
}
```

Response:

```json
{
  "checkoutUrl": "https://provider/...",
  "paymentRid": "...",
  "provider": "fake|stripe|paystack|..."
}
```

Open `checkoutUrl` (WebView / browser). On return, continue to place order once payment succeeds (provider / webhook driven on the server).

7. `POST /orders` (auth required):

```json
{
  "addressId": "{{addressRid}}",
  "paymentMethodId": "card",
  "cartItemIds": ["{{cartItemRid}}"],
  "paymentToken": "optional"
}
```

Response `201`:

```json
{
  "orderId": "<orderRid>",
  "orderReference": "#HCO....",
  "estimatedDelivery": "...",
  "status": "..."
}
```

Store `orderId` (rid) for confirmation and tracking screens.

### 9.2 After order

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/orders` | List (`status`, `search`, `page`, `limit`) |
| `GET` | `/orders/:orderRid` | Detail |
| `GET` | `/orders/:orderRid/tracking` | Tracking timeline |
| `POST` | `/orders/:orderRid/buy-again` | Re-add lines to cart |
| `GET` | `/orders/buy-again` | Suggested repurchase products |
| `POST` | `/orders/:orderRid/return` | `{ "reason": "..." }` |

See visual flow `06-order-aftercare.postman_flow.json`.

---

## 10. Other public forms

Postman folders: **Newsletter**, **Placeholders**

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/newsletter/subscribe` | Email subscribe |
| `POST` | `/newsletter/unsubscribe` | Unsubscribe (token / email per collection) |
| `POST` | `/partnerships/inquiries` | Partnership form |
| `POST` | `/quotations` | Quotation request |
| `POST` | `/support/agent-requests` | Support agent request |

These return acknowledgement JSON. They do not require auth.

---

## 11. Recommended journeys (Flows)

Use these when implementing screens. Each exists as:

- A visual canvas in `flows/*.postman_flow.json`
- A sequential folder under **Flows** in the collection

| # | Journey | What to verify |
|---|---------|----------------|
| 01 | Auth lifecycle | check-email → login → me → refresh → logout |
| 02 | Catalog discovery | categories → list → detail → related → reviews → search |
| 03 | Guest browse → merge | guest add → login → merge → get cart |
| 04 | Checkout happy path | login → cart → address → preview → shipping → payment-intent → order |
| 05 | Account management | profile, address, payment method, wishlist, review |
| 06 | Order aftercare | list → tracking → buy-again → return |

### Opening visual Flows

These files are **not** Import targets. Use the desktop app:

1. Open **Flows** → **Local View** ([Native Git](https://learning.postman.com/docs/postman-flows/get-started/flows-native-git/); web app does not support Local View)
2. Connect the local folder that contains `flows/`
3. Right-click a flow under **Local Files** → **Open Flow**
4. Set flow env `baseUrl` (and `categoryRid` where needed)
5. Click **Run**

Deep link (URL-encode the absolute path):

`postman://app/flows/open?filePath=/absolute/path/to/flows/01-auth-lifecycle.postman_flow.json`

CLI (optional): `postman flows run flows/01-auth-lifecycle.postman_flow.json`

If Local View is unavailable, run the same journeys from the imported collection’s **Flows** folder with Collection Runner.

Docs: [Postman Flows](https://www.postman.com/product/flows/), [Native Git](https://learning.postman.com/docs/postman-flows/get-started/flows-native-git/).

---

## 12. Environment variables cheat sheet

Defined in `HandCO.local.postman_environment.json` (and mirrored as collection variables):

| Variable | Set by | Used for |
|----------|--------|----------|
| `baseUrl` | You | All API calls |
| `webhookBaseUrl` | You | Webhook folder only |
| `accessToken` | Login / Register / Refresh scripts | Bearer auth |
| `refreshToken` | Same | Refresh |
| `userRid` | Auth scripts | Debugging / account |
| `cartRid` | Cart response `X-Cart-Id` | Guest / checkout cart header |
| `productRid` | Product list scripts | Detail / wishlist / cart add |
| `variantRid` | Optional | Variant-aware add to cart |
| `cartItemRid` | Cart scripts | Update / remove / place order |
| `addressRid` | Address create scripts | Checkout / shipping |
| `orderRid` | Place order / list scripts | Order detail / aftercare |
| `paymentRid` | Payment intent | Webhook QA |
| `paymentMethodRid` | Payment method create | Account payments |
| `categoryRid` | Default `electronics` | Catalog filters / panel |
| `reviewRid` | Waiting reviews script | Submit review |
| `regionRid` | Region lookup | City lookup |
| `historyRid` | History scripts | Delete selected history |
| `unsubscribeToken` | Newsletter | Unsubscribe |

When building your own HTTP client, mirror this state in app stores (auth store, cart store), not as globals.

---

## 13. Frontend integration checklist

Use this as an implementation punch list:

1. **Config:** `VITE_API_BASE_URL` (or equivalent) = `…/api/v1`.
2. **HTTP client:** JSON headers, Bearer interceptor, single-flight refresh on `401`.
3. **Rids only:** never coerce ids to numbers; treat all ids as strings.
4. **Cart persistence:** store `X-Cart-Id` from responses; send on cart and checkout.
5. **Merge on login:** keep guest cart rid through the auth call; merge if lines remain.
6. **Selection model:** only selected cart lines checkout.
7. **Money:** calculate with `amount` + `currency`; format for display separately.
8. **Errors:** map `error.code` to UI copy; fall back to `error.message`.
9. **Route guards:** any account / wishlist / orders screen must handle `401`.
10. **Verify with Postman:** run Flows 01, 03, and 04 against the same environment your app uses before wiring UI.

---

## 14. Collection map (where to click)

| Collection folder | Client feature area |
|-------------------|---------------------|
| Auth | Sign-in, register, session, password reset |
| Catalog | Home strips, PLP, PDP |
| Search | Search page, typeahead |
| Cart | Cart drawer / page |
| Wishlist | Wishlist |
| Checkout | Checkout steps before provider redirect |
| Orders | Order history, confirmation, tracking, returns |
| Profile | Account profile and security |
| Addresses | Address book + geo lookups |
| Payment Methods | Saved cards / networks |
| Reviews | Leave a review |
| Browsing History | Recently viewed |
| Notifications | Notification preferences |
| CMS | Home / footer / legal pages |
| Newsletter | Footer subscribe |
| Placeholders | Partnership / quote / agent forms |
| Flows | End-to-end scripts for QA |
| Webhooks | Not for client apps |

Every request in the collection is named to match the action. Open a request to see method, URL, headers, sample body, and (where present) test scripts that capture rids into environment variables.

---

## 15. Support and change process

- If a Postman example and this guide disagree, trust the **live response** from the shared environment, then update your client to match.
- Prefer asking for a new collection export over hand-editing URLs: named requests and scripts keep rid capture working.
- When filing bugs, include: request name from the collection, `baseUrl`, HTTP status, response body, and whether `accessToken` / `X-Cart-Id` were present.

Welcome aboard. Start with **Auth → Login**, then **Catalog → List products**, then Flow **03** and **04**. That covers most of what a storefront needs on day one.
