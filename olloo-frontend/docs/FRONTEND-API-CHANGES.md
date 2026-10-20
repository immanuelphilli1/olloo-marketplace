# Frontend API Changes (Checkout Hardening)

What changed on the API, what you must update in the client, and what stayed
the same. Auth stays Bearer (`Authorization: Bearer <accessToken>`).

## 1. Auth now resolves on every API route (bug fix)

Previously, guest-capable routes (cart, checkout) silently ignored valid
Bearer tokens, so calls ran as guest: empty carts, 401 on shipping-quote with
a saved address. Fixed server-side; no client change needed. If you worked
around this by re-sending `X-Cart-Id` everywhere, remove the workaround (see
section 2).

## 2. `X-Cart-Id` is guest-only now

- Guest (no token): keep sending `X-Cart-Id` (or rely on the `cart_id`
  cookie). First cart call needs no header; the response returns it.
- Authenticated: **omit `X-Cart-Id`**. The server resolves your user cart
  from the token and ignores the header.
- Exceptions (still send both Bearer and guest `X-Cart-Id`):
  `POST /cart/merge` and `POST /orders` consume the guest rid to merge.

## 3. `POST /checkout/payment-intent` — auth required, empty body

Before:

```json
{
  "callbackUrl": "https://your.app/checkout/return",
  "cancelUrl": "https://your.app/checkout/cancel",
  "email": "demo@handco.test",
  "paymentMethodId": "card"
}
```

After: `POST /checkout/payment-intent` with `{}` and a Bearer token. The
backend picks the provider (per currency), the customer email (your account),
and the return URLs. Response unchanged:

```json
{
  "checkoutUrl": "https://provider/...",
  "paymentRid": "pay_abc123",
  "provider": "stripe"
}
```

Persist `paymentRid` and `provider` before redirecting to `checkoutUrl`.

## 4. Return URLs carry our reference

Both return and cancel URLs now include `?reference=<payment rid>`, attached
by us (never dependent on the provider echoing anything back). On return,
read `reference` from the URL and query status (section 5). Do not parse
provider-specific params (`session_id`, `trxref`); they are supplementary.

## 5. New: `GET /payments/{paymentId}` status endpoint

Auth required, owner-scoped. Poll after the provider redirects back.

```json
{
  "rid": "pay_abc123",
  "provider": "stripe",
  "status": "pending",
  "amount": { "amount": 199.0, "currency": "AED" },
  "orderId": null
}
```

- `401` logged out / bad token.
- `404` unknown rid, or belongs to another user.
- Redirects are UX only; this endpoint plus webhooks are the source of truth.

## 6. `POST /orders` — `paymentMethodId` removed

Before:

```json
{
  "addressId": "addr_123",
  "paymentMethodId": "card",
  "cartItemIds": ["line_1"],
  "paymentToken": "optional"
}
```

After:

```json
{
  "addressId": "addr_123",
  "cartItemIds": ["line_1"],
  "paymentToken": "pay_abc123"
}
```

`paymentToken` is the payment rid from payment-intent. The order records the
payment's provider server-side. No payment details are collected at order
time. The only payment methods the API deals with are saved provider tokens
(used at payment-intent for re-pay), listed via `GET /payment-methods`.

## 7. Payment methods — add/update removed

Removed: `POST /payment-methods`, `PATCH /payment-methods/:id`. Remaining:
`GET /payment-methods` (list), `DELETE /payment-methods/:id`,
`PATCH /payment-methods/:id/default`, `GET /payment-methods/networks`.
Clients never send card data; only provider tokens and masked details are
stored.

## 8. Test account and Postman

- New seeded customer: `jaygrey.jg@gmail.com` / `password` (also
  `demo@handco.test` / `password`). Flow `07 Checkout flow` logs in with the
  former.
- Flows 04 and 07 rewritten for the above: Bearer on every post-login step,
  no `X-Cart-Id` except merge/place-order, empty payment-intent body, status
  check step included.

## Unchanged

Cart, preview, shipping-quote, wishlist, addresses, orders list/detail
request/response shapes. Preview still returns the static `paymentMethods`
display list; provider selection stays server-side per currency.
