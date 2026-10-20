# HandCO UAT run-through

Joint session: frontend developer plus backend. Work top to bottom against
staging. Spec reference: `docs/openapi.yaml` (machine contract),
`docs/API.md` (human companion).

## Entry criteria

- [ ] Staging API reachable; `GET /api/v1/products` returns 200 with seeded products.
- [ ] Seeded accounts exist: customer `demo@handco.test`, staff `admin@handco.test`, password `password`.
- [ ] Payments on staging run a test provider (confirm which: fake / Stripe test / Paystack test).
- [ ] A product with stock, a GHS-priced product, and active shipping rules for AE exist.

| # | Flow and steps | Expected | Pass | Notes |
|---|---|---|---|---|
| A1 | Open product listing with no destination (no `?country=`, signed out). | Items load; `deliveryQuote` and `priceInclTaxMoney` are null; `facets.delivery` is null; delivery filter hidden. | | |
| A2 | Same listing with `?country=AE`. | Cards show `deliveryQuote` (`{ free, fee, minDays, maxDays }`) and `priceInclTaxMoney`; `facets.delivery.deliveryDays` lists the filter options. | | |
| A3 | Search `?q=` for a known brand. | The listing filters to matches. | | |
| A4 | Open a product detail; check variants, gallery, `discountNotice`, `variantOptions` size/color. | Detail matches admin data; `priceMoney` formats to the displayed price. | | |
| A5 | Product reviews tab on a reviewed and an unreviewed product. | Approved reviews only; `avgRating` 0.0 and empty list when none. | | |
| B1 | As guest, add an item (note `X-Cart-Id`), change quantity, deselect, re-select. | Cart persists across refresh via the header/cookie; summary totals update. | | |
| B2 | `GET /locale?country=GH`, then list products and add one to the cart with the same `?country=GH`. | Locale says GHS; listing, cart lines and totals are in GHS at the admin Currencies page's shopper rate. | | |
| B3 | Repeat B2 with `?country=NG` (currency not sold), and with GHS rates older than 36h. | Everything stays in AED; no error. | | |
| B4 | Register a new account while the guest cart has items. | Items merge into the user cart; guest cart gone. | | |
| C1 | `check-email` with new, existing-password, and Google-only addresses. | `register`, `password`, `oauth` next steps respectively. | | |
| C2 | Login, view profile, change name, change email (confirm it asks for password). | Profile updates; email change requires password. | | |
| C3 | Enable 2FA (render `otpauthUrl` as a QR, keep `secret`), log out, log back in. | Provisioning shown once; account still accessible. Disable with password. | | |
| D1 | Add address (Ghana and UAE), set default, duplicate, delete default. | Default drives destination; deleting default promotes newest. | | |
| E1 | Checkout preview with and without a default address. | Without: address null, `tax` null, `totalIncludesTax` false. With: shipping fee, tax lines, methods for the currency. | | |
| E2 | Shipping quote with an unknown country string. | 422 `country_not_found`, readable message. | | |
| E3 | Place order (note totals), then raise a variant price in admin and place again. | First order frozen; second attempt 409 `price_changed` showing old and new prices; retry succeeds. | | |
| E4 | Pay the order with a chosen `paymentMethodId`, then poll `GET /payments/{paymentRid}`. | Redirect to `checkoutUrl`; status flips to paid without trusting redirect params. | | |
| E5 | Retry payment-intent on the paid order. | 409 `order_already_paid`. | | |
| E6 | Repeat E3 without `Idempotency-Key`, then twice with the same key. | 428 first; second identical call replays (`Idempotent-Replayed`). | | |
| E7 | Use one `Idempotency-Key` for both `POST /orders` and `POST /checkout/payment-intent`; also retry the order call with the JSON keys in the other order. | Both succeed (keys are per endpoint, key order is ignored); one order and one payment exist. | | |
| E8 | After a `409 price_changed` (or any 4xx), resend the corrected request with the same key. | Real request runs; no `idempotency_key_reused`, no replayed stale error. | | |
| F1 | Orders list: filter by each status, search by reference. | Correct subsets; `totalMoney` and `placedAt` present. | | |
| F2 | Order detail: totals equal items plus shipping plus tax; `taxes[]` matches the receipt components. | Numbers reconcile to the minor unit. | | |
| F3 | Request a return on a delivered order inside the window. | 201 with `returnId`; second request 422 `return_already_open`. | | |
| F4 | Return on a non-returnable category (staff flags one first) and on an order past its window. | Both 422 `return_not_allowed` with reasons. | | |
| G1 | Delivered line appears under reviews waiting; submit a 5-star review. | Status `pending`; storefront rating unchanged until staff approves. | | |
| G2 | Staff approves the review in admin; recheck product rating and counts. | `ratingValue`, `reviewCount` updated. | | |
| G3 | Wishlist add, move cart lines to wishlist, wishlist category filter. | Lines move; cart empties of them; filter narrows. | | |
| G4 | Browse history: view products, check grouped history, delete one entry, clear all. | Sections group by day; deletions stick. | | |
| G5 | Newsletter subscribe, unsubscribe with bad token, unsubscribe with real token. | 201, 404, 200 respectively. | | |
| H1 | Admin creates a product with description, gallery upload, discount notice, sized/colored variants, tags in order. | Storefront shows all of it; first tag is the badge. | | |
| H2 | Admin edits a category to non-returnable with a 14-day window; place and deliver an order for it. | Detail shows `returnEligibility` with the window and deadline. | | |
| H3 | Admin adds a tax rate and a shipping rule, then runs `delivery:refresh`-equivalent. | New quotes and tax appear for the destination. | | |
| H4 | Admin adds a payment method (scoped to a currency), toggles it off. | Checkout endpoint and preview follow within the same session. | | |
| H5 | Admin uploads a product image and a payment method logo. | Files served from `/storage/...`; `imageUrl`/`iconUrl` absolute. | | |
| H6 | Admin countries sync. | New countries appear; AE/GH rows update, never duplicate or delete. | | |

## Exit and sign-off

- [ ] Every row above is Pass or has an agreed follow-up issue filed.
- [ ] No console errors or unhandled 500s during the session.
- [ ] Responses contain only structured money, raw dates, and `tags`; no display strings remain.
- [ ] No response carries an `id` field for a resource; identifiers come from `rid` (category nodes use `slug`).
- [ ] Category nodes read `slug` where they used to read `id`.
- [ ] Guest checkout is not attempted without an account: register or login happens before `POST /orders`.

| Role | Name | Date | Signature |
|---|---|---|---|
| Frontend | | | |
| Backend | | | |
