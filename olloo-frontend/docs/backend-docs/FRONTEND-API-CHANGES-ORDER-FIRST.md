# Frontend API Changes (Order-First Checkout, Stock, Catalog Attributes)

Breaking changes to checkout, plus additive changes to cart, catalog,
addresses and reviews. Auth stays Bearer. Follows
[FRONTEND-API-CHANGES.md](./FRONTEND-API-CHANGES.md).

## 1. Checkout order is now: place order, then pay

The old flow paid for the cart first and attached the payment to the order
afterwards, which allowed unpaid orders and payments that did not match the
order. Now:

1. `POST /orders` creates the order **awaiting payment**, with totals fixed at
   current prices and stock held.
2. `POST /checkout/payment-intent` with that `orderId` opens the provider
   checkout for exactly the order total.
3. The provider redirects back; poll `GET /payments/{paymentId}` (unchanged).
   The webhook marks the order paid.

### `POST /orders`

`paymentToken` is removed. Send the `Idempotency-Key` header (section 2).

```json
{ "addressId": "addr_123", "cartItemIds": ["line_1", "line_2"] }
```

`201`:

```json
{
  "orderId": "8efrrdn8u9ei",
  "orderReference": "#HCO5241124542",
  "estimatedDelivery": "Estimated delivery date: 3-5 business days",
  "status": "pending_payment",
  "paymentStatus": "unpaid",
  "total": { "amount": 199.0, "currency": "AED" }
}
```

The ordered lines leave the cart at this point.

### `POST /checkout/payment-intent`

Body now requires the order. Send the `Idempotency-Key` header.

```json
{ "orderId": "8efrrdn8u9ei" }
```

`200`:

```json
{
  "checkoutUrl": "https://checkout.stripe.com/...",
  "paymentRid": "pay_abc123",
  "provider": "stripe",
  "orderId": "8efrrdn8u9ei",
  "amount": { "amount": 199.0, "currency": "AED" }
}
```

| Error | Status | Meaning |
|---|---|---|
| `order_not_found` | 404 | Unknown order, or not yours. |
| `order_already_paid` | 409 | Show the order instead. |
| `order_not_payable` | 409 | Cancelled (for example unpaid too long). Place a new order. |

A failed or abandoned payment leaves the order awaiting payment: call
payment-intent again for the same `orderId` to retry.

### Unpaid orders expire

Orders still awaiting payment after 60 minutes (configurable,
`PAYMENTS_ORDER_PAYMENT_WINDOW_MINUTES`) are cancelled and their stock
released. The window restarts on each payment attempt.

## 2. `Idempotency-Key` header (required on two endpoints)

`POST /orders` and `POST /checkout/payment-intent` require
`Idempotency-Key: <uuid>`. Generate one per user action (one per "Place
order" click) and **reuse it when retrying that same action** after a timeout
or network error.

| Case | Response |
|---|---|
| Header missing | `428 idempotency_key_required` |
| Same key, same body, first call finished | The first response is replayed, with header `Idempotent-Replayed: true` |
| Same key while the first call is still running | `409 idempotency_in_progress`: retry shortly |
| Same key, different body | `422 idempotency_key_reused`: generate a new key |

Keys are kept for 24 hours.

## 3. Prices are always current; changes need the shopper's review

Cart responses now price every line at today's price. Each line has new
fields:

```json
{
  "rid": "line_1",
  "price": 199.0,
  "priceMoney": { "amount": 199.0, "currency": "AED" },
  "previousPrice": { "amount": 179.0, "currency": "AED" },
  "variant": "Standard",
  "variantRid": "pv_123",
  "sku": "AEROSMART-EARBUDS-STD",
  "stockQuantity": 12,
  "available": true
}
```

- `previousPrice` is set when the price moved since the shopper added the
  item; highlight it. It is `null` otherwise.
- `POST /orders` with any such line returns `409 price_changed`:

```json
{
  "error": {
    "code": "price_changed",
    "message": "Some prices changed since you added these items. Review the new prices and place the order again.",
    "details": {
      "items": [
        {
          "cartItemId": "line_1",
          "previousPrice": { "amount": 179.0, "currency": "AED" },
          "price": { "amount": 199.0, "currency": "AED" }
        }
      ]
    }
  }
}
```

The conflict records that the shopper has now seen the new price. Show it,
then submit again **with a new `Idempotency-Key`** (the body is the same, but
it is a new decision).

Other order-time conflicts (all `409`): `item_unavailable` (product hidden;
`details.cartItemIds`), `insufficient_stock` (`details.items[]` with
`variantRid`, `requested`, `available`), `currency_mismatch`, `cart_changed`
(retry).

## 4. Stock

- `POST /cart/items` and `PATCH /cart/items/{id}` return `422
  insufficient_stock` (`details.variantRid`, `details.available`) when the
  quantity exceeds stock.
- `stockQuantity: null` means the variant is not stock-tracked (made to
  order) and never sells out.
- `POST /cart/items` without `variantId` uses the product's default variant.
- Products in a different currency than the cart are rejected with `422
  currency_mismatch`.

## 5. Order status and payment status are separate

Orders gain `paymentStatus` (`unpaid`, `paid`, `failed`, `refunded`), and
`status` is now `pending_payment`, `processing`, `shipped`, `delivered` or
`cancelled`. `processing` means paid and being prepared. The old `pending`
and `failed` statuses no longer exist.

`GET /orders?status=` accepts `all`, `returns`, or any status above.
`statusBadgeLabel` for `pending_payment` is "Awaiting payment".

Order detail items gain `sku`.

## 6. Products: attributes, stock, shipping fee

List items keep `brand`, `color`, `screenSize` and `delivery`, and add:

- `attributes`: every attribute with its display name, in the order the
  category lists them. Render `label: value` directly:

  ```json
  [
    { "key": "brand", "label": "Brand", "value": "Sony" },
    { "key": "screenSize", "label": "Screen size", "value": "65\"" },
    { "key": "delivery", "label": "Delivery", "value": "Free delivery" }
  ]
  ```

  `key` is stable and is what filters use; `label` can change when staff
  rename the attribute.
- `inStock`: the default variant can be bought.

Filters: the existing `brand`, `color` and `screenSize` params still work.
Any attribute filters as `?attributes[material]=Leather`. Facets keep
`brands`, `colors` and `screenSizes`, and add
`attributes` (`{ name: [values] }`) and `attributeLabels` (`{ name: "Screen
size" }`) for filter headings. Which attributes exist is set per category in
the admin, so new ones can appear without an API change.

Product detail: `variants[]` gain `stockQuantity`, `inStock`,
`handlingDays` and `deliveryQuote`. Delivery fields are covered in section
10.

## 7. Addresses link to the country list

- `country` accepts an ISO code (`AE`), a country rid, or the exact country
  name. Unknown countries are now rejected (`422`). Shipping rules match on
  the ISO code, so this fixes country-specific shipping fees.
- Optional `regionId` and `cityId` (rids from the lookup endpoints) link the
  address to the lookup lists. Without them, `region` and `city` are matched
  by name when possible and otherwise kept as typed.
- Responses add `countryCode`, `countryRid`, `regionRid` and `cityRid`.
  `country` is the country name.
- `POST /checkout/shipping-quote` resolves `country` the same way.

## 8. Reviews are moderated

- `POST /reviews` creates the review as pending; the response has
  `"status": "pending"`. It appears on the product once staff approve it.
- `GET /reviews/reviewed` items gain `status` (`pending` or `published`).
- A second review of the same order line returns `404` (the line has left
  the waiting list), or `409 review_exists` if two submits race.

## 9. Closing an account

`DELETE /users/me` is unchanged for clients. The account is closed (it can no
longer sign in) but its orders are kept. The same email can register again.

## 10. Delivery is worked out from shipping

`delivery` used to be free text typed per product ("Free delivery",
"Delivery in 3 days"). It is now computed from the store's shipping rules
(fee and courier transit days) plus each variant's handling time, **for a
known destination only**:

- `?country=AE` (ISO code, rid or name) on any product endpoint, or
- the signed-in customer's default address.

Without a destination, every delivery field is `null`: the store does not
claim a fee or speed it cannot back up.

Product cards:

```json
{
  "delivery": "Free delivery in 2-4 business days",
  "deliveryQuote": {
    "free": true,
    "fee": { "amount": 0, "currency": "AED" },
    "minDays": 2,
    "maxDays": 4
  }
}
```

Product detail: `shippingFee`/`shippingFeeMoney` (this product alone),
`deliveryEstimate` (`"2-4 business days"`), and per variant
`deliveryQuote` (with a `label`) because handling time differs by variant.

Listing filters (need a destination, otherwise `422 destination_required`):

| Param | Meaning |
|---|---|
| `freeDelivery=1` | Only products that ship free to the destination |
| `maxDeliveryDays=3` | Only products delivered within 3 business days |

The old `delivery=<text>` filter and the `deliveryOptions` facet are gone.
`facets.delivery` is `{ "freeCount": 4, "maxDays": [3, 5, 11] }` with a
destination, `null` without.

Checkout (`GET /checkout/preview`, `POST /checkout/shipping-quote`):
`shipping.deliveryDays` (`{ "min": 3, "max": 5 }`) and `feeMoney` are new;
`deliveryWindow` is now computed (`"Delivery in 3-5 business days"`). Carts
with bulky items are priced per shipping class and summed, and the window is
the slowest group's. Orders store the same window in `estimatedDelivery`.

## Unchanged

Cart merge, preview, wishlist, browsing history, payment status endpoint,
webhooks, category endpoints.
