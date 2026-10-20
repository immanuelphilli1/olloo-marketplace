# Client change notes (API cleanup + tax/variants/returns)

Date: 2026-10-03. All deprecated fields below still work but will be removed in a later version.

## 1. Format money from `Money`, not display strings

Every amount now has a structured `Money` (`{ amount, currency }`) next to any string:

| Deprecated string | Use instead |
|---|---|
| product `price`, `originalPrice` | `priceMoney`, `originalPriceMoney` |
| product `priceAmount` + `priceCurrency` (detail) | `priceMoney` |
| product `shippingFee` | `shippingFeeMoney` |
| cart `summary` strings | `summary` is all `Money` already (`itemsTotal`, `itemsDiscount`, `subtotal`, `shipping`, `tax`, `total`) |
| cart item `price` (number) | `priceMoney` (`previousPrice` is `Money` when the price moved) |
| order list `total` | `totalMoney` |
| review `priceAmount` | `priceMoney` |

## 2. Format UI text client-side from raw values

The server no longer owns wording/formatting for these:

| Deprecated text | Raw replacement |
|---|---|
| product `discount` (`"-18%"`) | `discountPercent: number \| null` |
| product `delivery` | `deliveryQuote: { free, fee: Money, minDays, maxDays } \| null` |
| product detail `deliveryEstimate` | `deliveryDays: { min, max } \| null` |
| checkout/shipping-quote `fee`, `deliveryWindow` | `feeMoney`, `deliveryDays` (already present) |
| order `statusDateLabel`, `statusBadgeLabel` | `status` + `statusDate` (ISO) |
| order `orderTime` | `placedAt` (ISO) |
| review `date`, waiting-review `deliveredOn` | `createdAt`, `deliveredAt` (ISO) |
| product `rating` | `ratingValue` (number) |

## 3. Search: use `GET /products?q=`

`GET /products/search` is a deprecated alias. It still works but returns
`Deprecation: true`, `Sunset: Sat, 01 Aug 2026 00:00:00 GMT` and
`Link: </api/v1/products>; rel="successor-version"`. Move to `?q=` on `GET /products`.

## 4. New fields (no action needed unless you use them)

- Tax: prices are tax-exclusive. `priceInclTaxMoney` + `taxRatePercent` appear
  for a known destination (`?country=` or default address); cart `summary`
  has `tax`, `taxes[]`, `totalIncludesTax`; order detail has `taxes[]` and
  totals include tax. Charged: AE 5% VAT; GH NHIL 2.5% + GETFund 2.5% + VAT 15%
  (compound).
- Variants: `size` and `color` per variant (`variantOptions[]`, `variants[].size/color`).
- Returns: order detail has `returnEligibility: { eligible, reason, windowDays, deadline }`;
  `POST /orders/:orderId/return` can now fail `return_not_allowed` for
  non-returnable categories or an expired window.
- Products: `reviewCount`, `soldCount` on list items; detail has
  `originalPriceMoney`, `discountPercent`, `deliveryDays`, `imageUrls`.
