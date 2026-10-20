# HandCO Frontend — Not Integrated

Backend capabilities from `docs/backend-docs` that are **not yet wired** into the
UI, or only partially wired. This file lists **gaps only**.

Integrated items are tracked in [INTEGRATED.md](./INTEGRATED.md). Contract defects
found and fixed are in [OPENAPI-AUDIT-REPORT.md](./OPENAPI-AUDIT-REPORT.md).

API base URL: `https://handco.craftsmanjohn.com/api/v1` (see `.env.example`).

**Last reviewed: 2026-10-04.** Every "not wired" claim below was re-verified
against the source rather than carried forward.

---

## Everything not integrated — at a glance

**44 rows, 49 items.** Numbered 1–44 below; the social row counts as 6 links in
one row, which is where rows and items differ.

**2** need a live request to settle · **15** endpoints implemented but never
called · **12** footer links do nothing · **3** are not supported by the backend
· **6** API fields are received but never rendered · **7** are partially done

> **Item 44 is now integrated.** `POST /orders/{orderId}/cancel` (scoped to unpaid
> orders) was supplied outside `openapi.yaml` and is wired to the Cancel order
> button on `pending_payment` orders. It is **not** in the spec file — worth adding
> there so the contract is documented.

Three previously-unwired endpoints were integrated in the most recent pass and
are listed under **Newly integrated** below rather than as gaps:
`getShippingQuote`, `forgotPassword`, and `getPaymentNetworks`.

### Needs a live request first (2)

| # | Item | What to run |
|---|------|-------------|
| 1 | Category identifier — client reads `slug`/`id`, spec has neither | `GET /categories` |
| 2 | Delivery facet key — fixed to `deliveryDays`, unconfirmed live | `GET /products?country=AE` |

### Implemented but never called (15)

| # | Function | Endpoint | Blocked on |
|---|----------|----------|-----------|
| 4 | `getSecurity` | `GET /users/me/security` | Security panel is static |
| 5 | `updateEmail` | `PATCH /users/me/email` | Security panel is static |
| 6 | `updatePhone` | `PATCH /users/me/phone` | Security panel is static |
| 7 | `updatePassword` | `PATCH /users/me/password` | Security panel is static |
| 8 | `deleteAccount` | `DELETE /users/me` | No deletion UI or confirm step |
| 9 | `submitQuotation` | `POST /quotations` | No form (**was broken**, fixed) |
| 10 | `submitAgentRequest` | `POST /support/agent-requests` | No form (**was broken**, fixed) |
| 11 | `submitPartnershipInquiry` | `POST /partnerships/inquiries` | No form |
| 12 | `unsubscribeNewsletter` | `POST /newsletter/unsubscribe` | No token-handling UI |
| 15 | `getWishlistCategories` | `GET /wishlist/categories` | No wishlist filter (**type fixed**) |
| 16 | `getHomeContent` | `GET /content/home` | Hero/promo blocks static |
| 17 | `getFooterContent` | `GET /content/footer` | Footer columns static |
| 18 | `getCities` | `GET /addresses/lookup/cities` | City field is free text by design |
| 19 | `toAttributeSearchParams` | (serializer) | No attribute filter UI |
| 20 | `getCategoryPanel` | `GET /categories/:id/panel` | Unused; duplicates `GET /categories` |

### Newly integrated (3)

These were listed as "implemented but never called" and are now wired to real
UI. They are called out here because each had a contract detail that shaped the
integration.

| # | Function | Endpoint | Where it is used |
|---|----------|----------|------------------|
| 3 | `getShippingQuote` | `POST /checkout/shipping-quote` | `CheckoutView` re-quotes on every default-address rid change |
| 13 | `forgotPassword` | `POST /auth/forgot-password` | `SignInModal` gained a "Forgot password?" flow |
| 14 | `getPaymentNetworks` | `GET /payment-methods/networks` | Mobile-money network selector + network labels |

### Inert footer links (12)

| # | Link | Column |
|---|------|--------|
| 21 | Affiliate, Partnership & Influencer Program | COMPANY |
| 22 | Press Releases | COMPANY |
| 23 | Trending Products | SOURCE ON H&CO. |
| 24 | Request Quotation | SOURCE ON H&CO. |
| 25 | Connect with Agent | SOURCE ON H&CO. |
| 26 | Live Chat | CUSTOMER SUPPORT |
| 27 | Facebook, Instagram, TikTok, YouTube, LinkedIn, X | social row (6) |

Not inert, for contrast: `About H&CO.` and the five TERMS links are real routes;
the five MARKET PLACE entries are `<button>`s that navigate via `categoryId`.

### Not supported by the backend / by design (3)

| # | Item | Why it will not be integrated |
|---|------|-------------------------------|
| 28 | Guest checkout | `POST /orders` requires auth — no account-free checkout exists |
| 29 | OAuth via Facebook / Apple | API supports Google only (`unsupported_provider`) |
| 30 | Payment webhooks | Server-to-server only; the client polls `GET /payments/:id` |

### Received but never displayed (6)

| # | Item |
|---|------|
| 31 | Delivery fee amount (`deliveryQuote.fee`) |
| 32 | Tax-inclusive pricing (`priceInclTaxMoney`, `taxRatePercent`) |
| 33 | Variant size / colour |
| 34 | Variant stock & delivery |
| 35 | Order `sku` |
| 36 | Order `paymentStatus` badge |

### Partially done (7)

| # | Item |
|---|------|
| 37 | New Releases subcategories (4 of 5 have no data source) |
| 38 | Listing facets — some options derived locally |
| 39 | Attribute filters — serializer done, no controls |
| 40 | Price-change conflict — lines identified by cart item id only |
| 41 | Product gallery — live products expose 3 images, not 4 |
| 42 | Delivery filter — works, but needs a known destination |
| 43 | Return reference — now returned by the API, ignored by the UI |

---

## Unverified assumption

| Item | Status | Notes |
|------|--------|-------|
| Category identifier | **Unverified** | The client reads category ids from `slug`, then `id`, via `getCategoryNodeId`. `openapi.yaml`'s `CategoryNode` has **neither** field; `CLIENT-DEVELOPER-GUIDE.md` documents `id`. If the server sends neither, lookups miss and the UI falls back to hardcoded placeholder categories — silently, with no error. A comment in `catalogCategories.ts:66` asserts `slug` as settled fact, which is the claim in question. **Needs one live `GET /categories`.** |
| Delivery facet key | **Unverified** | Fixed in the audit to `facets.delivery.deliveryDays` per `openapi.yaml`. The previous code read `maxDays` and the "Within N days" options never rendered. **One live `GET /products?country=AE` confirms the deployed build agrees.** |

---

## Defined but never called

18 of the 84 exported service functions have no caller anywhere outside their own
definition. The endpoint is implemented, typechecked, and correct — there is
simply no UI for it yet. Grouped by what it would take to finish.

### Needs a form or modal

| Function | Endpoint | What is missing |
|----------|----------|-----------------|
| `submitQuotation` | `POST /quotations` | A quotation form. **Signature was fixed in the audit** — it required `email` + `name` and the client sent neither correctly, so it would have failed `422`. The footer link is inert. |
| `submitAgentRequest` | `POST /support/agent-requests` | A support/agent form. **Also fixed** — `name` was missing from the required set. |
| `submitPartnershipInquiry` | `POST /partnerships/inquiries` | A partnership form. Signature was already correct (`email`, `name`, `message`). |
| `unsubscribeNewsletter` | `POST /newsletter/unsubscribe` | Token-handling UI. The token arrives by email link; nothing reads it. |

`forgotPassword` is **no longer** in this list — `SignInModal` calls it. Note that
the reset half (`POST /auth/reset-password`) is still uncalled, since it is only
reachable from an emailed link.

### Needs a panel wired to existing data

| Function | Endpoint | What is missing |
|----------|----------|-----------------|
| `getSecurity` | `GET /users/me/security` | The security panel renders the static `securitySettings` object from `src/data/profile.ts`. Reading the real one also unlocks the 2FA flag. |
| `updateEmail` | `PATCH /users/me/email` | Same panel. |
| `updatePhone` | `PATCH /users/me/phone` | Same panel. |
| `updatePassword` | `PATCH /users/me/password` | Same panel. |
| `deleteAccount` | `DELETE /users/me` | No account-deletion UI, and no confirmation flow. |
| `getWishlistCategories` | `GET /wishlist/categories` | Wishlist category filtering. **Return type was also fixed** — typed `string[]`, actually `{rid, slug, label}` objects. Filter on `slug`. |

### Needs a consumer, not a form

| Function / export | Endpoint | What is missing |
|-------------------|----------|-----------------|
| `getHomeContent` | `GET /content/home` | `HeroSection` and the promo blocks remain static. |
| `getFooterContent` | `GET /content/footer` | Footer link columns remain static. |
| `toAttributeSearchParams` | (serializer) | Serializes `?attributes[key]=value`. Verified live against the API, but the filter panel exposes only brand, colour, screen size, price, rating and delivery. |
| `getCities` | `GET /addresses/lookup/cities` | `AddAddressModal` calls `getCountries` and `getRegions` but never `getCities`. **Appears deliberate:** the region field gets `suggestions={regions}` while the city field is a plain `FloatingField`. Not a broken dropdown — but cities are free text matched by name, so shipping rules keyed on `cityId` can never match. |

**Not gaps, despite being uncalled:**
- `getCategoryPanel` (`GET /categories/:id/panel`) returns the same tree as
  `GET /categories`, so the modal reads from `useCatalog()` rather than adding a
  request per open.
- `listProducts` / `searchProducts` (`GET /products`) are used internally by
  `listAllProducts` / `searchAllProducts` for auto-pagination.

---

## Authentication & security

| Item | Status | Notes |
|------|--------|-------|
| OAuth sign-in (Facebook, Apple) | Not integrated | The API supports Google only (`unsupported_provider`). The two buttons in `SignInModal` remain inert. |
| Forgot password request | **Integrated** | `SignInModal` has a "Forgot password?" entry point that calls `authApi.forgotPassword`. The confirmation shown is the API's own wording, which is deliberately non-committal — the endpoint always succeeds to avoid revealing which addresses are registered. |
| Reset password (set the new one) | Not integrated | `POST /auth/reset-password` takes `{email, token, password, password_confirmation}`. It is only reachable from the emailed link, so nothing in the app calls it yet. |
| Token refresh retry | Partial | `api/client.ts` retries once on 401 via `/auth/refresh`; no dedicated session-expired UX. |
| 2FA enable / disable | Not integrated | Endpoints exist under `/users/me/2fa/*`; no account UI. `getSecurity` (which would report `twoFactorEnabled`) is itself uncalled. |
| Account deletion | Not integrated | `accountApi.deleteAccount` exists; no UI. |
| Email / phone / password updates | Not integrated | Security panel renders static `securitySettings`; the three PATCH functions are unused. |

---

## CMS content

| Item | Status | Notes |
|------|--------|-------|
| CMS home content | Not integrated | `cmsApi.getHomeContent` unused; `HeroSection` and promo blocks remain static. |
| CMS footer content | Not integrated | `cmsApi.getFooterContent` unused; footer link columns remain static. |
| CMS about page | Not integrated | `AboutPageContent` uses static copy from `src/data/about.ts`; `useCmsPage('about')` is not applied, unlike the legal pages. |

---

## Inert links & buttons

Every `<a href="#">` renders as a real link that does nothing when clicked — it
scrolls nowhere and, worse, looks interactive. Re-verified by source inspection on
2026-10-04.

### Footer — COMPANY column
| Link | Status | Notes |
|------|--------|-------|
| Affiliate, Partnership & Influencer Program | Inert | No `href` and no `categoryId`, so it falls through to `<a href="#">`. `formsApi.submitPartnershipInquiry` exists but is unwired. |
| Press Releases | Inert | Falls through to `<a href="#">`. No route and no CMS page behind it. |

`About H&CO.` is **not** inert — it has a real `href="/about"`.

### Footer — SOURCE ON H&CO. column
| Link | Status | Notes |
|------|--------|-------|
| Trending Products | Inert | `href="#"`. Could be a `/search?sort=trending` view, but no such route exists. |
| Request Quotation | Inert | `href="#"`. `formsApi.submitQuotation` exists but is unwired. |
| Connect with Agent | Inert | `href="#"`. `formsApi.submitAgentRequest` exists but is unwired. |

### Footer — CUSTOMER SUPPORT column
| Link | Status | Notes |
|------|--------|-------|
| Live Chat | Inert | `href="#"`. No chat widget is mounted. |

### Footer — social icons
| Link | Status | Notes |
|------|--------|-------|
| Facebook, Instagram, TikTok, YouTube, LinkedIn, X | Inert | All six render from a single `socialIcons.map()` with a hardcoded `href="#"`; no target URL is configured for any of them. |

**Total: 12 inert rendered links** — 2 COMPANY + 3 SOURCE + 1 SUPPORT + 6 social.
Counted as *rendered* links: the social row expands from one `socialIcons.map()`
into six `<a href="#">` elements.

> **Correction (2026-10-04):** an earlier revision said 13, counting the COMPANY
> column as 4. It has 3 links and only 2 are inert — `About H&CO.` has a real
> `href="/about"`. The MARKET PLACE column's 5 entries are `<button>`s that
> navigate via `categoryId`, so they are not inert either.

---

## Payment methods

| Item | Status | Notes |
|------|--------|-------|
| Payment networks list | **Integrated** | `usePaymentNetworks` reads `GET /payment-methods/networks` and feeds the mobile-money network selector in `AddPaymentMethodModal`, replacing a hardcoded three-entry list. Saved methods store an enum key (`mtn`), so `getPaymentNetworkLabel` resolves it to the API's label for display in `PaymentMethodsPanel` and `YourOrdersView`. The audit also corrected the return type to `{id, label}[]`. |

### Known limitation on the networks list

The network selector lives in `AddPaymentMethodModal`, which is **not currently
rendered by any route** — it has no caller. The API also exposes no create/update
endpoint for saved payment methods (cards are tokenized provider-side and only
listed, defaulted and deleted), so there is no supported flow for adding a saved
mobile-money method through this client today. The fetch, the fallback list and
the label resolution are all wired and correct; what is missing is a mounted
surface to reach them.

---

## Orders & checkout gaps

| Item | Status | Notes |
|------|--------|-------|
| Shipping quote on address change | **Integrated** | `CheckoutView` runs a `useEffect` keyed on the default address's rid and calls `checkoutApi.getShippingQuote(rid)`, so the fee, delivery days and courier update whenever the address changes instead of staying on the mount-time preview. The preview still seeds the panel, so a failed quote keeps a price on screen rather than blanking it. |
| Guest shipping quote | Implemented, not called | `getShippingQuote` accepts a raw address (`country` required) for a guest with no saved address, matching the spec. No UI calls that form yet, since checkout itself requires auth. |
| Quote `summary` totals | Implemented, not surfaced | The response's `summary` (`CartSummary`) is typed and available but the order summary panel still renders its own totals rather than the quote's. |
| Guest checkout | Not integrated | `POST /orders` requires auth; checkout submit no-ops when signed out (the sign-in modal opens first). By design — the API has no account-free checkout. |
| Return reference shown to shopper | Not integrated | `returnOrder` now returns the API's `{success, returnId, rid, status}` (it previously discarded the body), but `YourOrdersView` ignores the value — the modal owns its own success state. Showing the reference is a small follow-up. |

---

## Public forms & newsletter

| Item | Status | Notes |
|------|--------|-------|
| Newsletter unsubscribe | Not integrated | `formsApi.unsubscribeNewsletter` exists; no token-handling UI. |
| Partnership inquiries | Not integrated | `formsApi.submitPartnershipInquiry` unwired; footer link inert. |
| Quotation requests | Not integrated | `formsApi.submitQuotation` unwired; footer link inert. **The function was broken until this audit** — it sent `details` where the API requires `name` and `message`. |
| Agent support requests | Not integrated | `formsApi.submitAgentRequest` unwired; footer link inert. **Also fixed** — `name` was missing from the required set. |

---

## Typed but not displayed

The API sends these and the client types them correctly, but no UI renders them.

| Item | Notes |
|------|-------|
| Delivery fee amount | `deliveryQuote.fee` is populated (e.g. `AED 200` for AE, `AED 90` for GH) but the cards show only the window. The fee is read in `formatDeliveryQuote` only to decide free vs paid. |
| Tax-inclusive pricing | `priceInclTaxMoney` / `taxRatePercent` appear for a known destination and are `null` on anonymous reads. No "incl. VAT" label is rendered. Cart `summary.tax` **is** shown on the checkout summary. |
| Variant size / colour | `variants[].size/color` and `variantOptions[].size/color` are all `null` in the live data. The detail page still renders the flat `modelOptions` list. |
| Variant stock & delivery | `variants[]` carry `stockQuantity` (null = made to order), `inStock`, `handlingDays` and a per-variant `deliveryQuote`. The detail page shows none of it, and the variant selector does not disable sold-out options. |
| Order `sku` | Order detail items carry `sku`. Typed, not rendered. |
| `paymentStatus` on orders | `ApiOrderRecord.paymentStatus` (`unpaid`/`paid`/`failed`/`refunded`) is carried through, but the order card shows only the `status` badge — so "Awaiting payment" does not indicate whether payment later failed or was refunded. |

---

## Partial

| Item | Notes |
|------|-------|
| New Releases subcategories | `Latest Arrivals` loads from `GET /products/new-arrivals`. `Just Dropped`, `Fresh Picks`, `Coming Soon` and `Limited Edition` have no backend data source — the product payload exposes no date field (no `createdAt`/`addedAt`/`publishedAt`) and no endpoint filters by date, so "added within the week" and "random per day" cannot be computed. They fall through to the standard `categoryId=new-releases` query. |
| Listing facets & filters | Server-side filters are applied, but some facet options still derive from locally loaded data rather than a dedicated facets endpoint. |
| Attribute filters | `facets.attributes` (`{ name: [values] }`) and `attributeLabels` are live, and any attribute filter can be sent via `?attributes[key]=value` (serializer `toAttributeSearchParams`, verified live). **The serializer has no caller**, so admin-configured attributes are not selectable. Product `attributes[]` **is** rendered on the detail page. |
| Price-change conflict detail | `price_changed` shows old vs new price per line, but the lines are identified only by cart item id, since `details.items[]` carries no product name. |
| Product image count | `imageUrls` is read and preferred over `images`, but live products only expose 3 URLs, so the gallery has fewer slides than the fixed 4 it used to render. |
| Delivery quotes & filter | Works, but needs a destination: `facets.delivery` is `null` unless the request carries `?country=`. `src/hooks/useProductDestination.ts` supplies it (signed-in default address, else `AE`). Options are derived from the facet and filter via `freeDelivery=true` / `maxDeliveryDays=N`. |

---

## Environment & setup

Ensure `.env` contains:

```
VITE_API_BASE_URL=https://handco.craftsmanjohn.com/api/v1
```

Demo credentials (from backend docs): `demo@handco.test` / `password`, or
`jaygrey.jg@gmail.com` / `password`.

---

## Suggested next steps

Ordered by value per unit of work.

1. **Wire the account security panel** to `getSecurity` + the three PATCH
   functions. All four are implemented and unused; this unlocks email, phone,
   password, and the 2FA flag in one pass.
2. **Build the three footer forms** (quotation, agent, partnership). Two of the
   three service functions were outright broken until this audit, so they need a
   real `name` field in the UI regardless.
3. **Add the reset-password half** of the flow. The request step is done; only
   `POST /auth/reset-password` remains, and it needs a route for the emailed link
   (`?email=…&token=…`) plus a new-password form.
4. **Mount `AddPaymentMethodModal`** so the network selector is reachable. Its
   fetch is wired; nothing renders it. Blocked on a supported way to save a method,
   since the API exposes no create/update endpoint.
5. **Surface the quote's `summary`** in `OrderSummaryPanel` so the totals come
   from the same call that priced the destination, instead of a separate preview.
6. **Wire `cmsApi.getHomeContent` / `getFooterContent` / `useCmsPage('about')`** to
   remove the remaining static CMS copy.
7. **Build the attribute filter UI** — the serializer is done and verified; only
   the controls are missing.
8. **Settle the two unverified items above** with one live request each, then
   align `openapi.yaml` and `CLIENT-DEVELOPER-GUIDE.md` to the answers.

Recently completed, no longer next steps: shipping re-quote on address change,
the forgot-password request flow, and sourcing mobile-money networks from the API.