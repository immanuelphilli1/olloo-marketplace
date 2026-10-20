# Payment methods

How checkout routes to a provider: by **method plus currency**.

## Model

`payment_methods` (checkout methods: card, mobile money, ...). Not the same as
`saved_payment_methods` (a shopper's stored instruments).

| Field | Meaning |
|---|---|
| `code` | Unique handle, e.g. `card`, `mtn_momo` |
| `label` | Shown to shoppers |
| `provider` | `stripe`, `paystack`, `fake`, `paypal`, `tabby`, or `tamara` (must exist in `config/payments.php`) |
| `icon` | Optional icon key; the frontend maps it to brand artwork |
| `currencies` | Codes served, e.g. `["GHS"]`. Empty means every currency |
| `countries` | Destinations served, e.g. `["GH"]`. Empty means everywhere |
| `sort_order`, `is_active` | Ordering and availability |

Leave `currencies` and `countries` empty only for a method that genuinely works
everywhere; an empty list opts the method into every cart.

Inactive methods never serve. Providers are pinned per row, one gateway per
market: UAE (AED/AE) on Stripe, Ghana (GHS/GH) on Paystack. Seeded:

| Code | Label | Provider | Currencies | Countries | State |
|---|---|---|---|---|---|
| `aed_cards` | Card | `stripe` | AED | AE | active |
| `apple_pay` | Apple Pay | `stripe` | AED | AE | active |
| `google_pay` | Google Pay | `stripe` | AED | AE | active |
| `ghs_cards` | Card | `paystack` | GHS | GH | active |
| `mobile_money` | Mobile Money | `paystack` | GHS | GH | active |
| `paypal` | PayPal | `paypal` | AED | AE | inactive |
| `tabby` | Tabby | `tabby` | AED | AE | inactive |
| `tamara` | Tamara | `tamara` | AED | AE | inactive |

The pre-split `card` row is retired (set inactive) rather than deleted, so past
payments keep their reference. Seeder uses `firstOrCreate`, so staff edits to
labels, providers or icons survive reseeds.

Every active method is scoped to a currency and a country, so a cart only ever
sees methods that can settle it. A gateway rejects a currency it is not
onboarded for: Paystack answers an AED transaction with "No active channel to
process transaction", which is why the currency/provider pairing is fixed in the
seed rather than resolved from a global default.

## Drivers

| Method | Provider | How it works |
|---|---|---|
| Card, Apple Pay, Google Pay | `stripe` | Wallets ride on Stripe Checkout automatically once enabled in the Stripe dashboard (Apple Pay also needs domain verification). No extra code. |
| Mobile Money | `paystack` | Paystack's hosted checkout presents MoMo for GHS transactions. No extra code. |
| PayPal | `paypal` | Orders API v2: order, buyer approves on paypal.com, we capture, webhooks confirm. Stripe cannot process PayPal. |
| Tabby | `tabby` | Session (AED/SAR only), buyer approves, we capture in full. |
| Tamara | `tamara` | Session (SAR/AED/BHD/KWD/OMR), buyer approves, we authorise then capture in full. |

Approval-style providers (PayPal, Tabby, Tamara) move no money on approval.
Settlement marks the order paid from their approved/authorised state, then a
queued job collects: `CapturePaypalOrder`, `CaptureTabbyPayment`,
`AuthoriseAndCaptureTamaraOrder`. Each job is idempotent, so duplicate
webhooks only re-check. Tamara auto-captures after 21 days if we never do.

Instalments never touch our books: Tabby and Tamara pay out the full total
minus their fee and collect from the shopper themselves. Partial captures or
refunds land on the payment as `needs_review` for staff to reconcile.

## Routing

`POST /checkout/payment-intent` accepts optional `paymentMethodId` (rid or code):

- Given: the method must exist (`404 payment_method_not_found`), be active, and
  serve the order currency and destination (`422 payment_method_unavailable`
  otherwise). Its provider is used; the payment stores `payment_method_id`.
- Omitted: previous behaviour, the order currency row's `payment_provider`.
  Unknown or blank providers fail loudly, never fall back.

## Going live per provider

1. Put credentials in `.env` (see `.env.example`): PayPal client/secret plus
   the webhook id; Tabby secret key plus merchant code (base URL picks the
   region: `api.tabby.ai` UAE, `api.tabby.sa` KSA); Tamara API token plus
   notification token (sandbox default, production `api.tamara.co`).
2. Register `POST /webhooks/{provider}` at the provider: PayPal webhook with
   the id above; Tabby webhook with a static header titled `X-Webhook-Key`
   matching `TABBY_WEBHOOK_KEY` (plus their IP allowlist); Tamara order webhook
   (Approved event mandatory).
3. Sandbox-test the full loop, then activate the method in admin Settings,
   Payment methods. Tabby additionally requires their QA before live keys.
