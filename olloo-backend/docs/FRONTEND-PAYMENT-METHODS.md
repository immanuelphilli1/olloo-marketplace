# Frontend guide: payment methods

All checkout payment options now come from the backend. Do not hardcode the
method list.

## What changed

- `GET /checkout/preview` still returns `paymentMethods`, but each entry is
  now `{ id, rid, code, label, icon, iconUrl }` sourced from admin settings.
  The old fixed six no longer exist.
- New public endpoint: `GET /payment-methods/checkout?currency=AED&country=AE`
  returns the same shape plus `currencies` and `countries`. Use it wherever
  checkout is reachable without a cart (it needs no auth).
- `POST /checkout/payment-intent` accepts optional `paymentMethodId` (rid or
  code) and echoes it back as `paymentMethodId` in the response.
- Review payloads expose `createdAt`; waiting reviews expose `deliveredAt`
  and `priceMoney`.

## Rendering rules

- `icon` is either a short artwork key (`card`, `apple_pay`, `tabby`, ...) or
  an uploaded path/URL. `iconUrl` is set only for the path/URL case.
- Render `iconUrl` when present. Otherwise map `icon` (or `code`) to your
  brand artwork as before. Never build a URL out of a bare key.
- Method availability already accounts for currency and the shopper's market.
  Send `currency` alone if you only have that. Never derive availability from
  the shipping country yourself: a card pays an order shipping anywhere, and
  filtering on the destination is what previously emptied the list.
- An empty list is possible but no longer the normal case. Markets with no
  methods of their own fall back to the store default currency's rows, and you
  get those back rather than an empty array. Do not ship a checkout screen that
  assumes it can hide its payment step when the array is empty; show an error
  instead, because there is nothing for the shopper to pick.

## Checkout flow with a chosen method

1. Show the methods from preview (or the checkout endpoint). Send the
   shopper's pick as `paymentMethodId`.
2. Redirect to `checkoutUrl` as before. Unknown ids give `404
   payment_method_not_found`; methods that do not serve the order currency
   give `422 payment_method_unavailable`. Fall back to the method list in both
   cases.
3. Keep polling `GET /payments/:paymentId`. Approval-style methods (PayPal,
   Tabby, Tamara) approve first and capture after, so the first poll may read
   pending longer than a card payment. Do not treat that as failure.
4. Tabby can decline a shopper (`422` from payment-intent with a plain message).
   Show the message and offer the remaining methods.

## Admin side (for reference)

Staff manage the list in Settings, Payment methods: labels, uploaded logos,
per-method currencies and countries, a fallback toggle, on/off, and each
currency's provider and store default. A fallback method is offered only when
the shopper's market has no methods of its own, so it never appears alongside
the normal options. Anything they change is reflected by these endpoints with no
client release.
