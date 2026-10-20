# Frontend ↔ OpenAPI Contract Audit

**Spec audited:** `docs/backend-docs/openapi.yaml` (OpenAPI 3.0.3, 79 path items)
**Code audited:** `src/api/**` (client, config, 9 service modules, `types.ts`, `mappers.ts`)
**Date:** 2026-10-04
**Status:** All nine findings below are **fixed**. `tsc -b`, `npm run lint`, and
`npm run build` all pass; lint is unchanged from the pre-fix baseline
(19 errors / 3 warnings, all pre-existing and all outside `src/api`).

---

## Verdict

The integration is in good shape structurally: every request body the client
sends matches the spec's field names, the `rid`-based identifier convention is
respected in all path params, and error handling branches on `error.code`
rather than message text as the spec requires.

Nine defects were found and fixed. Four were silent — the request went out, the
server answered, and the client read a field that was not on the wire, so the UI
showed empty or `undefined` with no error. Two would have failed validation
outright.

---

## Method

Base URL is `https://handco.craftsmanjohn.com/api/v1` (`src/api/config.ts`), so
spec paths `/v1/...` are called as `/...`. Every `apiRequest` call was extracted
and compared against the spec's method, path, path/query parameters, request
body schema, and response schema. Response types in `types.ts` were then compared
field-by-field against the `components/schemas` they reference, and mapper
consumption was checked for each field flagged as divergent.

## Fix summary

| # | Severity | Area | Defect | Fix |
|---|---|---|---|---|
| 1 | High — silent | Checkout | `PlaceOrderResponse.total` should be `totalMoney` | Renamed |
| 2 | High — fails | Account | `deleteBrowsingHistory` sent `rids`, spec requires `ids` | Body key corrected |
| 3 | High — fails | Content | `submitQuotation` sent `details`, spec requires `name` | Signature corrected |
| 4 | Medium — silent | Catalog | Delivery facet read `maxDays`, spec sends `deliveryDays` | Renamed |
| 5 | Medium — silent | Payments | `getPaymentNetworks` typed `string[]`, spec returns objects | Retyped |
| 6 | Medium — silent | Wishlist | `getWishlistCategories` typed `string[]`, spec returns objects | Retyped |
| 7 | Low — silent | Orders | `returnOrder` typed `void`, spec returns a body | Body returned |
| 8 | Low — waste | Catalog | `page`/`limit` sent to endpoints that accept neither | Params dropped |
| 9 | Low — gap | Account | `avatar` accepted by profile PATCH, never sent | Field added |

---

## 1. `PlaceOrderResponse.total` — field did not exist (silent)

**Severity: High.** Silent: `total` was declared required on the frontend type
but the API never sent it, so it read `undefined` on every successful order.

Spec, `POST /v1/orders` 201:

```yaml
required: [orderId, orderReference, estimatedDelivery, status, paymentStatus, totalMoney]
# ...
totalMoney: { $ref: '#/components/schemas/Money' }
```

The rest of the API is consistent about `*Money` naming, and `OrderRecord`
(the order-list schema) also uses `totalMoney` — so this was a genuine
field-name mistake, not an intentional alias.

**Fixed** — renamed in `src/api/types.ts`:

```393:398:src/api/types.ts
export type PlaceOrderResponse = {
  orderId: Rid
  orderReference: string
  estimatedDelivery: string
  status: ApiOrderStatus
  paymentStatus: ApiOrderPaymentStatus
  /** Order total frozen at placement, already including tax. */
  totalMoney: Money
}
```

Safe to rename: the only call site reads `orderId`, `orderReference`, and
`estimatedDelivery`, all of which were already correct. `ShopContext.lastOrder`
stores only those same three fields, and `YourOrdersView` / `OrderTrackingModal`
read `order.total` from the *order detail* mapper, which maps `totalMoney`
correctly at `mappers.ts:257`. No caller touched the broken field.

---

## 2. `deleteBrowsingHistory` sent the wrong body key (fails)

**Severity: High.** A hard failure: the body key did not match, so the request
failed validation and history could not be deleted.

Spec requires `ids`:

```yaml
schema:
  type: object
  required: [ids]
  properties:
    ids:
      type: array
      minItems: 1
      items: { type: string }
      description: History entry rids.
```

The client had the right values under the wrong key — `BrowsingHistoryPanel`
already built `serverRids` from the correct `rid` values and already guarded
against an empty list.

**Fixed** in `src/api/services/account.ts`:

```284:295:src/api/services/account.ts
/**
 * Deletes the given history entries.
 *
 * The body key is `ids` (not `rids`) and takes history *entry* rids, which are
 * the `rid` on each item rather than the product rid nested inside it. The
 * backend rejects the request when the key is wrong, so this is not
 * interchangeable with the parameter name.
 */
export async function deleteBrowsingHistory(ids: string[]): Promise<void> {
  // `minItems: 1`, so an empty list is a guaranteed 422 rather than a no-op.
  if (ids.length === 0) return
  await apiRequest('/browsing-history', { method: 'DELETE', body: { ids } })
}
```

The `minItems: 1` guard was added rather than left to the caller's existing
check, so the service is safe to call directly with an empty array.

---

## 3. `submitQuotation` sent `details`, spec requires `name` (fails)

**Severity: High.** `name` was required and absent, so every quotation request
would have failed with `422 validation_error`. `details` is not a spec field at
all — the spec's free-text field is `message`.

Spec requires `email` **and** `name`:

```yaml
required: [email, name]
properties:
  email: { type: string, format: email, maxLength: 255 }
  name: { type: string, maxLength: 120 }
  company: { type: string, maxLength: 160 }
  phone: { type: string, maxLength: 40 }
  message: { type: string, maxLength: 5000 }
  productIds: { type: array, items: { type: string } }
```

**Fixed** in `src/api/services/forms.ts` — both affected endpoints, with
`name` made **required** so the compiler forces any future caller to supply it,
plus the optional fields the spec accepts:

```42:61:src/api/services/forms.ts
/**
 * Requests a quotation.
 *
 * `email` and `name` are required by the endpoint, and the free-text field is
 * `message` — there is no `details`. Both are enforced here so a form cannot
 * compile against a body the API rejects with `422`.
 */
export async function submitQuotation(input: {
  email: string
  name: string
  message: string
  company?: string
  phone?: string
  /** Product rids of interest. Stored, not validated. */
  productIds?: string[]
}): Promise<void> {
```

`submitAgentRequest` had the same missing `name` on `/v1/support/agent-requests`
and was fixed identically, plus `phone` and `orderId`.

Neither function was called anywhere in the app at audit time (only
`subscribeNewsletter` was wired up, in `Footer.tsx:204`), which is why this never
surfaced. They remain unwired, so the fix is type-level only — a quotation or
agent form still has to be built, and it must collect a name.

---

## 4. Delivery facet read the wrong key (silent)

**Severity: Medium.** Silent: the array read `undefined`, the `??` guard made it
empty, and the "delivery within N days" filter options silently vanished from
the filter panel. Free-delivery counting still worked because `freeCount`
matched, which is what masked it.

Spec, `ProductListing.facets.delivery`:

```yaml
delivery:
  type: object
  nullable: true
  required: [freeCount, deliveryDays]
  properties:
    freeCount: { type: integer }
    deliveryDays:
      type: array
      items: { type: integer }
      description: Distinct upper delivery-day cut-offs present in this listing; build the maxDeliveryDays filter options from it.
```

The spec's wording is unusually explicit — "build the maxDeliveryDays filter
options from it" — which reads like it was written to correct exactly this
mismatch. The `maxDeliveryDays` *query* param name is what likely misled the
implementation into naming the response field `maxDays` too.

**Fixed** in `src/api/types.ts` (type) and `src/api/mappers.ts` (read):

```136:143:src/api/types.ts
export type ApiDeliveryFacet = {
  freeCount: number
  deliveryDays: number[]
}
```

```101:101:src/api/mappers.ts
  const maxDays = [...new Set(delivery.deliveryDays ?? [])].sort((a, b) => a - b)
```

The local variable keeps the name `maxDays` deliberately: it describes what each
entry *is* (an upper bound), while `delivery.deliveryDays` names the wire field.
Two doc comments that described the old wire shape were corrected too, so the
next reader is not misled back into the same bug.

**Impact when broken:** only when a destination country is known, since `delivery`
is null otherwise. Guests correctly saw the section hidden; signed-in shoppers
with a saved address quietly lost their day options.

---

## 5. `getPaymentNetworks` typed `string[]` (silent)

**Severity: Medium.** The function promised strings but the spec returns
objects, so any caller would have received `{id, label}` where strings were
declared — and `items` is not in the spec at all, so the fallback was dead code.

**Fixed** in `src/api/services/account.ts`:

```204:221:src/api/services/account.ts
/** A mobile-money network as the API lists it. */
export type PaymentNetwork = {
  /** Stable network key, e.g. `mtn`. This is an enum key, not a resource rid. */
  id: string
  /** Display name, e.g. `MTN`. */
  label: string
}

/**
 * Mobile-money networks.
 *
 * The spec returns one object per network, so the rows are passed through as
 * objects — `id` is the value to submit with a method, `label` is what to show.
 */
export async function getPaymentNetworks(): Promise<PaymentNetwork[]> {
  const response = await apiRequest<{ networks?: PaymentNetwork[] }>(
    '/payment-methods/networks',
    { auth: false, cart: false },
  )
  return response.networks ?? []
}
```

The spec's own conventions section flags this: the mobile-money network `id`
("mtn, vodafone_cash, ...") is one of the documented non-rid `id` fields — a
stable enum key, not a resource identifier, so `rid` is correctly absent.

Still no caller; it becomes usable as-is when mobile money is wired up.

---

## 6. `getWishlistCategories` typed `string[]` (silent)

**Severity: Medium.** Same shape of mistake as #5.

**Fixed** in `src/api/services/wishlist.ts`:

```11:28:src/api/services/wishlist.ts
/** A category present in the wishlist, as returned for the category filter. */
export type WishlistCategory = {
  rid: string
  /** The value to pass as `?category=` to `GET /wishlist`. */
  slug: string
  label: string
}

/**
 * Categories present in the wishlist, for the filter control.
 *
 * Rows are objects, not strings: filter on `slug`, which is what the listing
 * endpoint's `category` parameter accepts.
 */
export async function getWishlistCategories(): Promise<WishlistCategory[]> {
  const response = await apiRequest<{ categories?: WishlistCategory[] }>(
    '/wishlist/categories',
  )
  return response.categories ?? []
}
```

The return shape changed from `{ categories: string[] }` to `WishlistCategory[]`
so callers get rows directly. Still no caller — wishlist category filtering is
not yet in the UI.

---

## 7. `returnOrder` discarded a response body (low)

**Severity: Low.** Not a bug in itself, but the spec returns a meaningful body
that the client threw away, so it could not show a return reference or status.

Spec returns `201` with `{success, returnId, rid, status}`.

**Fixed** in `src/api/services/orders.ts` — the body is now returned as a typed
result:

```48:78:src/api/services/orders.ts
/**
 * The return request the backend opens.
 *
 * The endpoint answers `201` with this body, so it is returned rather than
 * discarded: `returnId`/`rid` identify the request (useful for support) and
 * `status` starts at `requested`.
 */
export type ReturnRequestResponse = {
  success: boolean
  /** Human-facing return reference. */
  returnId: string
  /** Resource rid of the return request. */
  rid: string
  status: string
}
```

The existing caller (`YourOrdersView.handleReturnRequest`) discards the value,
which still compiles — the return modal owns its own success and error states.
Surfacing the reference in the success message is a small follow-up if wanted,
deliberately left out here to avoid widening scope into UI copy.

Note this endpoint takes **no** `X-Cart-Id`/`CartId` parameter in the spec, and
the client correctly does not force one.

---

## 8. `page`/`limit` sent to endpoints that accept neither (low)

**Severity: Low.** Wasteful, and quietly misleading — the calls implied the
endpoints paginate when they do not.

`GET /v1/reviews/waiting` and `GET /v1/reviews/reviewed` declare **no** query
parameters at all, yet both were sending `page` and `limit`. Both responses are
`{ items: [...] }` with no `total`, `page`, or `limit`, so the client-side
`limit` did nothing and the caller had to truncate anyway.

**Fixed** in `src/api/services/account.ts` — the params are gone and the trim
happens client-side via a shared helper:

```236:260:src/api/services/account.ts
/**
 * Trims a review list to `count` rows.
 *
 * The list endpoints return the full set with no paging metadata, so the
 * dashboard's "show a few" behaviour is applied client-side rather than by
 * asking the server for a page.
 */
function sliceReviewItems(response: ReviewsResponse, count: number): ReviewsResponse {
  const items = response.items ?? response.reviews
  if (!items || items.length <= count) return response

  const trimmed = items.slice(0, count)
  // Preserve whichever key the endpoint actually used, so callers that read
  // `items` and callers that read `reviews` both keep working.
  return response.items ? { ...response, items: trimmed } : { ...response, reviews: trimmed }
}
```

The parameter changed from `(page, limit)` to `(count = 3)` / `(count = 4)`, so
the name no longer implies server-side paging. Both callers in `YourOrdersView`
invoke them with no arguments, so behaviour is unchanged. The helper preserves
whichever key the endpoint used (`items` or `reviews`) rather than assuming one.

**Also worth noting:** `GET /v1/products/{product}/reviews` *does* paginate
(`page`, `limit`, and echoes both back), and `getProductReviews` handles that
correctly. So the product-review endpoint is the inconsistent one — it is the
only one that can actually page.

---

## 9. `avatar` accepted but never sent (low)

**Severity: Low.** Spec allows it, client omitted it — no breakage, but the
avatar field the spec describes was unreachable from the UI.

**Fixed** in `src/api/services/account.ts` — `avatar` added to the input, and
`displayName` widened to `string | null` to match the spec's `nullable: true`:

```37:48:src/api/services/account.ts
/**
 * Partial profile update — only the sent fields change.
 *
 * `avatar` is a URL or path string, and `null` clears it, so it is passed
 * through verbatim rather than dropped when falsy.
 */
export async function updateProfile(input: {
  fullName?: string
  displayName?: string | null
  avatar?: string | null
}): Promise<ProfileResponse> {
```

No caller passes `avatar` yet, so this is capability-only: an avatar field in the
profile form can now reach the API.

---

## Verified correct

These were checked and are right; recording them so they are not re-litigated.

**Endpoint coverage.** Every spec endpoint the storefront needs is called. The
full mapping, all confirmed against the spec's `operationId`:

| Area | Endpoints | Status |
|---|---|---|
| Auth | check-email, register, login, logout, refresh, forgot-password, me, oauth url + exchange | complete |
| Catalog | categories, category panel, products, featured, new-arrivals, recommendations, detail, related, reviews, search suggestions | complete |
| Cart | get cart, add, patch item, delete item, delete selected, select-all, move-to-wishlist, merge | complete |
| Checkout | preview, shipping-quote, payment-intent, payment-methods/checkout | complete |
| Orders | list, detail, tracking, buy-again (both), return, place | complete |
| Payments | status, networks, list, delete, set default | complete |
| Reviews | waiting, reviewed, submit | complete |
| Wishlist | list, categories, add, remove | complete |
| Account | profile, security, email, phone, password, delete account, browsing history, notifications | complete |
| Addresses | list, create, update, delete, default, duplicate, 3 lookups | complete |
| Content | page, home, footer, newsletter ×2, partnership, quotation, agent | complete |

**Deliberately not called** (correctly):
- `/webhooks/{provider}` — spec says "Never called by clients."
- `/users/me/2fa/enable` and `/2fa/disable` — no 2FA UI exists yet; `getSecurity`
  does read `twoFactorEnabled`, so this is a gap only if 2FA is planned.
- `POST /auth/reset-password` — reachable only via the emailed link.

**Request bodies.** All match. Spot-checked the ones most likely to drift:
`POST /auth/register` correctly sends the Laravel pair `password` +
`password_confirmation` plus the required `fullName`; `PATCH /users/me/password`
sends all three required keys; `POST /cart/items` omits `variantId` rather than
sending `undefined`; `POST /checkout/payment-intent` omits `paymentMethodId`
entirely when unset, which the spec permits.

**Idempotency.** Correct and carefully handled — `POST /orders` and
`POST /checkout/payment-intent` both take a key, they get *separate* keys because
the bodies differ (the spec rejects the same key with a different body as
`422 idempotency_key_reused`), and a retry after a `price_changed` conflict
correctly takes a new key. This matches the spec's documented rules precisely.

**Cart-Id header discipline.** The `guestCartId` flag is applied to exactly the
two endpoints that consume the guest cart to merge it (`POST /cart/merge`,
`POST /orders`), which matches the client's own documented reasoning. Note
`POST /auth/register` and `POST /auth/login` also declare `CartId` and merge the
guest cart server-side, and the client does send the header there too — correct,
though the `guestCartId` flag is not needed for it since login/register are not
user-cart endpoints.

**Identifier convention.** Path params use `rid` throughout
(`/orders/{orderRid}`, `/addresses/{addressRid}`, `/wishlist/{productRid}`), and
`productId`/`cartItemIds`/`addressId` are sent as the spec's *body* field names,
which are explicitly `rid`-valued in the descriptions. Correct.

**Error handling.** `parseError` reads `error.code` / `error.message` /
`error.details`, and `HomePage` branches on `isOrderConflictCode(error.code)` —
never on message text, as the spec demands. All five `409` order conflict codes
are enumerated in `ORDER_CONFLICT_CODES`.

**Deprecated fields.** The client consistently prefers the new `*Money` /
`*Days` / ISO-timestamp fields over the deprecated display strings, with
`@deprecated` markers and fallbacks only. This matches
`docs/backend-docs/CLIENT-CHANGE-NOTES.md`. Good discipline.

---

## Left in place deliberately

Two things were flagged during the audit and **not** changed, because both are
defensive rather than wrong, and removing them is a judgement call that should
be made against a live API rather than the spec.

### `rid ?? id` fallbacks

Several places fall back to an `id` field the spec says does not exist — e.g.
`catalog.ts` de-duplicates with `item.rid ?? item.id`, and `types.ts` keeps
`id?: Rid` alongside `rid` on `ApiProductCard`, `ApiAddress`, `ApiOrderRecord`,
`ApiCategoryNode`, and others.

The spec is unambiguous: "There is no parallel `id` field anywhere in the API,"
and it enumerates the only legitimate `id`s — `NotificationSetting.id`, the
browsing-history bucket id, the mobile-money network id, and `facets` keys.
None of those are product, address, or order records.

This does not misread anything: when `rid` is present the fallback never fires.
But it does make real mismatches harder to spot — as #4 shows, a field that
genuinely did not match the spec would have been silently absorbed by exactly
this pattern. Worth pruning once you have confirmed the backend ships `rid`
everywhere.

### `CategoryNode.slug` is an assumption

`CategoryNode` in the spec has **no** `slug` field (only `rid`, `label`,
`image`, `imageUrl`, `children`), yet the client treats `slug` as "the wire field
and the value used everywhere as the category id." `CategoryPanel.parent` does
have `slug`, and the `categoryId` query param accepts a slug — so `slug` on a
plain `CategoryNode` is a client-side assumption, not a documented field.

This is the one place where a load-bearing client expectation is not backed by
the schema, and it drives the category link bar, `categoryId` filtering, and
`getApiChildNodes` lookups. **Worth confirming against one live response.**

---

## Verification

Static only: spec text compared against TypeScript source, then re-verified by
build. No claim here depends on a running server.

| Check | Result |
|---|---|
| `npx tsc -b` | pass |
| `npm run build` | pass (649 kB / 165 kB gzip) |
| `npm run lint` | 19 errors / 3 warnings — **identical to the pre-fix baseline**, verified by stashing the changes and re-running. None in `src/api`. |
| Lints on changed files | none |

The pre-existing lint errors are `react-hooks/set-state-in-effect` and
`react-refresh/only-export-components` findings in `main.tsx`, `HomePage.tsx`,
and components — unrelated to this work.

**Recommended live checks.** Two findings were field-name disagreements the spec
settles but a deployed build can still contradict:

1. `GET /products?country=AE` — confirms the delivery facet key is
   `deliveryDays` (#4). The one fix here that affects a user-facing filter.
2. `GET /categories` — confirms whether `CategoryNode` ships `slug`
   (see above).

Both are single unauthenticated requests.