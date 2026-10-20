# Client change notes (API cleanup + tax/variants/returns)

Everything below has been removed from the API. If your client still reads any
of it, switch to the replacement now. `docs/openapi.yaml` is the contract;
this file is the short list of what changed.

## 0. Removed outright

- Product `tag` (single badge) is gone. Use `tags[0]` instead. The `tags`
  array is unchanged and still in display order.
- `GET /products/search` is gone (now a 404). Use `GET /products?q=`.
- `id` is gone as a resource identifier everywhere. Every public resource is
  addressed by `rid` only; there is no parallel `id` field left to keep in sync.
  Affected: products, cart items, orders, order items, order detail, addresses,
  countries, regions, cities, saved payment methods, checkout payment methods,
  reviews (including the review create response), waiting reviews, wishlist
  lines, wishlist categories, browsing-history entries, and the browsing-history
  `POST` response.
  - `GET /categories`, `/categories/:categoryId`, and the category panel: the
    sidebar node's `id` (which held the **slug**) is now `slug`. `rid` is
    unchanged.
- Product styling hints `showAddButton`, `priceOrange`, `imageObjectPosition`
  are gone. They were rendering instructions, not domain data. Decide the look
  client-side from `inStock` (and per variant `stockQuantity` / `inStock`).
- 2FA enable no longer returns `qr` (it was byte-identical to `otpauthUrl`).
  Render the QR from `otpauthUrl`.
- `facets.delivery.maxDays` is renamed `facets.delivery.deliveryDays`. It was
  always the list of available delivery-day filter options (`[3, 5, 7]`), never
  a single maximum.
- `POST /orders` `201` returns `totalMoney` (`Money`), not `total`.

`id` fields that remain are **not** resource identifiers: notification setting
keys (`promotions`, `orderUpdates`), browsing-history bucket keys (`today`,
`yesterday`, `older`), and the mobile-money network list (`mtn`,
`vodafone_cash`, `airtel_tigo`, `telecel_cash`).

## 1. Money: format from `Money`

| Removed string | Replacement |
|---|---|
| product `price`, `originalPrice` | `priceMoney`, `originalPriceMoney` |
| product `priceAmount` (+ `priceCurrency`) | `priceMoney` |
| product `shippingFee` | `shippingFeeMoney` |
| cart `summary` strings | `summary` is all `Money` (`itemsTotal`, `itemsDiscount`, `subtotal`, `shipping`, `tax`, `total`) |
| cart item `price` (number) | `priceMoney` (`previousPrice` is `Money` when the price moved) |
| order list `total`, `POST /orders` `total` | `totalMoney` |
| review `priceAmount` | `priceMoney` |

`Money.amount` is in **major units** as a number (`179` is AED 179.00). This is
the deliberate wire convention; storage and provider calls use minor units
internally. The one exception is the order's frozen `shipping.feeMinor`, which
stays an integer in minor units because it is the settled snapshot.

## 2. UI text: format client-side from raw values

| Removed text | Raw replacement |
|---|---|
| product `discount` (`"-18%"`) | `discountPercent: number \| null` |
| product `delivery` | `deliveryQuote: { free, fee: Money, minDays, maxDays } \| null` |
| product detail `deliveryEstimate` | `deliveryDays: { min, max } \| null` |
| checkout/shipping-quote `fee`, `deliveryWindow` | `feeMoney`, `deliveryDays` |
| order `statusDateLabel`, `statusBadgeLabel` | `status` + `statusDate` (ISO) |
| order `orderTime` | `placedAt` (ISO) |
| review `date`, waiting-review `deliveredOn` | `createdAt`, `deliveredAt` (ISO) |
| product `rating` | `ratingValue` (number) |

Order detail keeps `estimatedDelivery` as free text frozen at placement time
(for example `"Estimated delivery: 3-5 business days"`). Display it as-is and
never parse it; the machine-readable window is `shipping.deliveryDays`.

## 3. Error payloads you can rely on

Business-state errors now have documented `details` shapes in the spec
(`x-error-codes` on the `Error` schema):

| Code | Status | `details` |
|---|---|---|
| `validation_error` | 422 | field name to list of messages |
| `price_changed` | 409 | `items[] { cartItemId, previousPrice, price }` |
| `insufficient_stock` | 422 / 409 | `{ variantRid, available }` when adding one line, `items[] { variantRid, requested, available }` when placing an order |
| `item_unavailable` | 409 | `cartItemIds[]` |
| `exchange_rate_unavailable` | 503 | none (no fresh rate for a needed currency pair; retry later) |
| `payment_method_unavailable` | 422 | `{ paymentMethodId, currency }` |
| `order_not_payable` | 409 | `{ status }` |
| `return_not_allowed` | 422 | `eligibility { eligible, reason, windowDays, deadline }` |

Branch on `error.code`, never on message text.

## 3b. Idempotency keys got looser (no code change needed, but read this)

`idempotency_key_reused` was firing for requests that were never a mistake.
Three rules changed:

- **Keys are scoped per endpoint.** One key per checkout session works: the
  same key places the order and opens the payment. Before, reusing a key across
  the two endpoints was a hard 422.
- **The request is compared canonically.** JSON key order and the order of the
  `cartItemIds` list do not make a request different.
- **Only successful responses are replayed.** Any failed attempt (4xx or 5xx,
  including `409 price_changed`) releases the key, so a corrected retry with the
  same key runs for real instead of replaying a stale error.

`422 idempotency_key_reused` now only means: this key already completed a
*different* request on this endpoint. `error.details.route` names it. If you
generate a fresh UUID per click, nothing changes for you.

## 4. New fields (no action needed unless you use them)

- Tax: prices are tax-exclusive. `priceInclTaxMoney` + `taxRatePercent` appear
  for a known destination (`?country=` or default address); cart `summary`
  has `tax`, `taxes[]`, `totalIncludesTax`; order detail has `taxes[]` and
  totals include tax. Charged: AE 5% VAT; GH NHIL 2.5% + GETFund 2.5% + VAT 15%
  (compound).
- Variants: `size` and `color` per variant (`variantOptions[]`, `variants[].size/color`).
- Returns: order detail has `returnEligibility: { eligible, reason, windowDays, deadline }`;
  `POST /orders/:orderId/return` can fail `return_not_allowed` for
  non-returnable categories or an expired window.
- Products: `reviewCount`, `soldCount` on list items; detail has
  `originalPriceMoney`, `discountPercent`, `deliveryDays`, `imageUrls`.

## 5. Not a guest checkout

There is no account-free checkout. Guests can browse, build a cart, and get
shipping quotes, but `POST /orders` requires auth, so a guest cart becomes an
order after register or login (the guest lines merge on login). Do not build a
checkout screen that assumes an order can be placed without an account.