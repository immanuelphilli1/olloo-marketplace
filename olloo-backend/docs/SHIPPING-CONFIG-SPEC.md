# Shipping Configuration Spec (Portal-Managed)

## 1. Goal

Staff can configure shipping fees from the admin portal without deploys or env
changes. Storefront quote shape stays identical; only the numbers and labels
behind it become portal-managed.

## 2. Current state (problems being fixed)

- `app/Services/ShippingService.php` returns a single flat fee from
  `config/shipping.php` (`SHIPPING_FEE_MINOR`, default 2000). No conditions,
  no portal control.
- `app/Services/CartService.php:253` computes cart-summary shipping
  differently (max per-product `shipping_fee_minor`, seeded 0). Cart totals
  and checkout totals can disagree today.
- Admin has no settings section for shipping. Closest existing pattern is the
  notification-recipients settings page:
  `app/Http/Controllers/Admin/NotificationSettingsController.php`,
  `app/Services/NotificationRecipientSettings.php`,
  `resources/js/Pages/Admin/Settings/NotificationSettings.tsx`,
  routes `admin.notification-settings.edit/update` (`routes/admin.php:118-119`),
  nav entry under System (`AdminLayout.tsx:98-117`), permission-gated.

## 3. Decisions

1. **Structured rules, not a formula DSL.** Free-text formulas need a parser,
   sandboxing, and a test harness in the portal. The rule model below covers
   flat, threshold, and country pricing. A `strategy` column reserves room
   for future rule types without schema changes.
2. **One resolver, two readers.** A dedicated `ShippingRuleResolver` evaluates
   rules. `ShippingService` and `CartService::summary()` both read through
   it, fixing the cart-vs-checkout mismatch. Behavior change is intentional
   and covered by tests (section 9).
3. **Dedicated `shipping_rules` table, not `AppSetting` keys.** Rules are
   ordered, multi-row, and conditional; key/value storage would serialize
   structure into strings. `AppSetting` stays for scalar settings.
4. **Fail closed, via a domain exception.** Missing configuration never
   becomes free shipping. The resolver throws `ShippingConfigurationException`;
   the HTTP layer translates it to the existing 500 `invalid_shipping_config`
   shape. Throwing a typed exception (instead of aborting inside the service)
   keeps logging, unit testing, and API-vs-web handling clean.
5. **Money stays minor-unit integers** with an explicit currency per rule,
   matching the codebase convention (`*_minor` columns, `money()` helper).
6. **No `metadata` JSON column.** A future `weight_based` strategy might want
   one, but it is not added for future-proofing alone. The `strategy` column
   plus a migration at that time is sufficient.
7. **No `free` strategy in v1.** `flat` with `fee_minor = 0` expresses free
   shipping; a separate always-zero strategy adds a concept without adding
   behavior. v1 strategies: `flat`, `free_over_threshold` (whose `fee_minor`
   must be 0, enforced by validation).

## 4. Data model

New table `shipping_rules` (new file, idempotent `Schema::create`):

| Column | Type | Notes |
|--------|------|-------|
| `id` | id | Primary key; used as deterministic tie-breaker after priority |
| `rid` | string(12), unique | Client/admin-facing id via `HasRid` |
| `name` | string(120) | Staff label, e.g. "UAE standard" |
| `strategy` | string(40) | `flat`, `free_over_threshold` (v1 set) |
| `fee_minor` | unsigned int | Applied fee; must be 0 for `free_over_threshold` |
| `currency_code` | char(3) | Must match a row in `currencies` |
| `country` | string(2), nullable | ISO code; null = any country |
| `min_subtotal_minor` | unsigned int, nullable | Threshold; required for `free_over_threshold` |
| `priority` | unsigned int | Lower evaluated first; ties share priority freely |
| `is_active` | bool | Default true |
| timestamps | | |

Composite index for the resolution path:
`INDEX(is_active, currency_code, country, priority, id)`. Rule counts will
stay tiny so this is schema hygiene, not optimization.

### Currency invariant (normative)

`fee_minor` and `min_subtotal_minor` are both denominated in the rule's
`currency_code`. Rules in the quote currency are tried first. A rule in
another currency is still eligible: its threshold is compared with the
subtotal converted back at the shopper rate, and its fee is converted at the
shopper rate (rounded up). A rule whose currency has no exchange rate younger
than `CURRENCY_MAX_RATE_AGE_HOURS` is skipped, never guessed.

## 5. Resolution

New classes under `App\Shipping`:

- `ShippingQuoteContext` (final readonly value object):
  `currency` (required string), `country` (?string, null when the destination
  is not known yet), `subtotalMinor` (required int, always present including
  0). Invariant: absence of a subtotal is represented by passing no context
  at all, never by a nullable subtotal. `subtotalMinor` stays non-nullable so
  threshold evaluation can never be ambiguous.
- `ShippingRuleResolver::resolve(?ShippingQuoteContext $context)` returns the
  matched rule model or throws `ShippingConfigurationException`.
- `ShippingQuote::fromRule($rule, $context)` builds the existing quote array
  shape (`feeMinor`, `currency`, `free`, `deliveryDays`, `courierLabel`,
  `estimatedDelivery`); the display strings (`fee`, `deliveryWindow`) were
  removed, so callers format money from `feeMinor` and days from
  `deliveryDays`. Labels stay env-based unless staff ask otherwise.

Eligibility predicate (all must hold):

- rule is active,
- `rule.currency_code = context.currency`,
- `rule.country IS NULL OR (context.country IS NOT NULL AND rule.country = context.country)`,
- `rule.min_subtotal_minor IS NULL OR context.subtotalMinor >= rule.min_subtotal_minor`.

Evaluation order is deterministic: `ORDER BY priority ASC, id ASC`. Shared
priorities are allowed; `id` breaks ties so ordering never depends on row
fetch order.

### No-context calls

`resolve(null)` (used pre-address, e.g. a bare preview) may only match rules
that require no context: `country IS NULL AND min_subtotal_minor IS NULL`.
A country-gated or threshold rule is never eligible without its dimensions
supplied, so a missing destination cannot accidentally resolve to a
country-specific rule. `ShippingService::quote(?ShippingQuoteContext $context
= null)` keeps its signature; all current callers pass or omit context as
today.

## 6. Service changes

- `ShippingService` delegates matching to the resolver and response building
  to `ShippingQuote`; it holds no rule logic itself.
- `CartService::summary()` builds a context from the cart (currency,
  selected-lines subtotal, no country) and calls the resolver instead of
  `max(shipping_fee_minor)`.
- `products.shipping_fee_minor` column stays (no rename per migration policy)
  but is no longer read; remove in a later cleanup once confirmed unused.
- Rule-set caching: single key `shipping.rules.v1` holding the ordered active
  rule collection; the resolver works against it. Invalidation happens
  **after commit** (`DB::afterCommit` on rule save/update/delete) so a rolled
  back transaction can never desync cache from database.

## 7. Admin portal

Mirror the notification-settings pattern:

- Permission `manage_shipping_settings` added to
  `AdminPermissionsSeeder::PERMISSIONS` (admin role inherits automatically).
- Routes `admin.shipping-rules.*` next to the notification settings routes;
  nav entry under the System group in `AdminLayout.tsx`, gated on the new
  permission.
- `ShippingRuleController` (index, create, store, edit, update, destroy,
  toggle active) + `StoreShippingRuleRequest` /
  `UpdateShippingRuleRequest` FormRequests (three-level validation per
  frontend rules; single-page sections form, no wizard).
- Inertia page `Admin/Settings/ShippingRules.tsx` (+ form component),
  primitives from `@/components/ui`, `cursor-pointer` on clickables.
- List shows name, strategy, fee, country, threshold, active flag, priority
  with numeric ordering.
- **Deletion/deactivation guard:** deactivation is the primary action; both
  destroy and the active toggle are refused when the target is the final
  active rule, so one click (or three successive toggles) cannot put the
  storefront into a 500 state. Destroy is otherwise kept for setup mistakes.
- **Test-quote panel (v1 should-have):** staff enter country, currency, and
  subtotal; the page calls a `POST admin/settings/shipping/test-quote`
  endpoint reusing the resolver and shows the matched rule plus a
  per-predicate checklist (active / currency / country / threshold) and the
  resulting fee. The checklist is presentation logic assembled by the admin
  controller from the rule and context; the resolver itself returns only the
  matched rule and knows nothing about checklist labels. No-match behavior is
  deliberately different from the storefront: the endpoint catches
  `ShippingConfigurationException` and returns 200 with `matchedRule: null`
  and the failed checks, while storefront resolution lets the exception
  propagate to a 500. Response shape:
  `{ matchedRule: {rid, name} | null, checks: [{label, passed}], fee: string | null, currency }`
  with match → `fee` = resolved shipping fee, no match → `fee` = null (never
  0: a missing configuration must not present as free shipping).

## 8. API impact

None on the storefront contract. `GET /checkout/preview`,
`POST /checkout/shipping-quote`, and cart responses keep their shapes;
only values change. `docs/API.md` gains one line noting fees are
portal-configured.

## 9. Tests

- Unit (resolver): threshold/country/fallback selection; no-match throws
  `ShippingConfigurationException`; inactive rules ignored.
- Unit (overlap, explicit):
  - Priority 10, UAE, subtotal >= 500, fee 0 + priority 20, UAE, any subtotal,
    fee 20 → UAE + 600 gives 0; UAE + 400 gives 20.
  - Priority 10, any country, fee 30 + priority 20, UAE, fee 20 → UAE gives
    30 (priority wins over specificity). These cases pin first-match
    semantics against future refactors.
- Unit (context): null context matches only context-free rules; null country
  never matches a country-gated rule.
- Feature (admin): CRUD behind `manage_shipping_settings` (403 without);
  validation rejects negative fees, unknown currency, non-zero fee on
  `free_over_threshold`, missing threshold on `free_over_threshold`;
  deactivating or deleting the final active rule is refused.
- Feature (storefront): changing a rule via the admin endpoint changes the
  checkout quote (proves after-commit invalidation); cart summary equals
  checkout shipping for the same cart.
- Regression: run full suite; seeder keeps existing quote values.

## 10. Rollout

Seeder creates one active `flat` rule from the current env fee
(`SHIPPING_FEE_MINOR`, name "Default flat rate"), so deploy behavior is
unchanged. Staff then refine rules in the portal.

## 11. Non-goals (v1)

- Free-text formula entry or per-courier live rate lookup.
- Per-product shipping overrides (superseded by rules).
- Multi-package / split-shipment calculation.
- Test-quote panel is should-have, not a launch blocker.

## 12. Addendum (2026-10): delivery and shipping classes

Supersedes parts of sections 5 and "No-context calls":

- Rules carry `transit_days_min/max` (courier business days) and an optional
  `shipping_class_id`. `ShippingQuote` and the env labels
  (`SHIPPING_DELIVERY_WINDOW`, `SHIPPING_ESTIMATED_DELIVERY`) are gone; the
  migration backfilled transit days from `SHIPPING_DELIVERY_WINDOW`.
- `ShippingRuleResolver::resolve(ShippingQuoteContext)` no longer accepts
  null. The context carries `shippingClassId`: rules for that class are tried
  first, then rules without a class. Standard items use classless rules only.
- `ShippingService::quoteLines(currency, country, ShippingLine[])` groups
  lines by class, prices each group with its own rule and sums the fees.
  Delivery days = max over groups of (longest handling in the group + rule
  transit). Variant handling is `product_variants.handling_days`, else
  `SHIPPING_DEFAULT_HANDLING_DAYS`.
- `product_delivery_quotes` caches each product's quote per rule country plus
  a NULL-country row for other destinations, refreshed on product, variant and
  rule changes (and `php artisan delivery:refresh`). Storefront delivery claims
  only appear when the destination is known.

