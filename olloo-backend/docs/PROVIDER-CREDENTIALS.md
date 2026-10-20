# Provider credentials: where to get them and where they go

For each provider: create the account, copy the values into `.env`, register
the webhook URL, then activate the method in admin Settings, Payment methods.
Webhook URL pattern (use your live domain):

```
https://<your-domain>/webhooks/{provider}
```

## Return and cancel URLs (per provider)

Each gateway redirects the shopper back on its own page, so the URLs are
configured per provider, the same way Google's OAuth redirect is its own
setting. There is no app-wide `PAYMENTS_RETURN_URL`.

```env
STRIPE_RETURN_URL=/checkout/return/stripe
STRIPE_CANCEL_RETURN_URL=/checkout/cancel/stripe
PAYSTACK_RETURN_URL=/checkout/return/paystack
PAYSTACK_CANCEL_RETURN_URL=/checkout/cancel/paystack
PAYPAL_RETURN_URL=/checkout/return/paypal
PAYPAL_CANCEL_RETURN_URL=/checkout/cancel/paypal
TABBY_RETURN_URL=/checkout/return/tabby
TABBY_CANCEL_RETURN_URL=/checkout/cancel/tabby
TAMARA_RETURN_URL=/checkout/return/tamara
TAMARA_CANCEL_RETURN_URL=/checkout/cancel/tamara
```

Each value may be a path or an absolute URL. A path is resolved against
`APP_URL`, which must itself be an absolute http(s) URL, otherwise checkout
fails loudly rather than guessing a host. Absolute values are used as-is, so a
storefront on a different domain can send the shopper there instead.

We append `?reference=<payment rid>` so the return page can check payment status
without trusting anything the provider echoes back.

Gateways pick the pair from the provider that actually handles the payment, so
a GHS order on Paystack gets the Paystack URLs and an AED order on Stripe gets
the Stripe ones, with no app-wide default to misroute.

## How a return works end to end

The shopper never lands on a page we host. Each hop is ours, so the browser is
never the thing we trust:

```
gateway ──► GET /checkout/return/{provider}?reference={payment rid}
             │  matches payments.providers.{provider}.return_url
             │
             ├─ 1. look the payment up by OUR reference, scoped to that provider
             ├─ 2. re-verify with the provider (verifyCharge), then settle
             └─ 3. 302 to WEB_CLIENT_URL/checkout/return
                      ?reference=…&provider=…&status=…&orderId=…
                      &orderReference=…&amount=…&currency=…
```

The reference is appended by us when the session is created, so it is already in
the URL the gateway redirects to. Nothing the provider echoes back is trusted.
`/checkout/cancel/{provider}` does the same without verifying, since a cancel is
not a payment.

The storefront reads `status` and can then confirm with
`GET /api/v1/payments/{reference}` (needs a bearer token; the redirect itself
does not). Statuses are the `payments.status` values: `pending`, `completed`,
`failed`, `refunded`, `needs_review`. If verification cannot reach the provider,
the shopper is still redirected with the status we already hold rather than
stranded, so a provider outage never traps someone mid-checkout.

`WEB_CLIENT_URL` must be an absolute http(s) URL. A missing or relative value
fails the redirect loudly instead of guessing a host.

## Stripe (card, Apple Pay, Google Pay)

1. Sign up at https://dashboard.stripe.com. Toggle **Test mode** (top right)
   while integrating.
2. Developers, API keys: copy the **Publishable key** and **Secret key**.
3. Developers, Webhooks, Add endpoint: URL `https://<your-domain>/webhooks/stripe`,
   listen to `checkout.session.completed` and `payment_intent.succeeded`.
   Copy the **Signing secret**.
4. Settings, Payment methods: turn on Apple Pay (nothing else needed for
   hosted Checkout; no Apple Developer account).
5. Going live: toggle off Test mode and repeat steps 2-3 with live keys.
   Test and live keys are different sets.

```env
STRIPE_KEY=pk_test_...
STRIPE_SECRET=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Paystack (mobile money, GHS)

1. Sign up at https://dashboard.paystack.com. You start in test mode.
2. Settings, API Keys & Webhooks: copy the **Public key** and **Secret key**.
3. Same page, add webhook URL `https://<your-domain>/webhooks/paystack`.
   Paystack signs with the secret key, so no separate webhook secret is
   required (leave the field empty unless you set one).
4. Going live: complete activation, then use the live keys.

```env
PAYSTACK_PUBLIC_KEY=pk_test_...
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_WEBHOOK_SECRET=
```

## PayPal

1. Sign up / log in at https://developer.paypal.com, go to Apps & Credentials.
   Create an app (or use the default) under Sandbox first.
2. Copy the **Client ID** and **Secret**.
3. In the same app, add a webhook: URL `https://<your-domain>/webhooks/paypal`,
   subscribe to `CHECKOUT.ORDER.APPROVED` and `PAYMENT.CAPTURE.COMPLETED`.
   Copy the **Webhook ID** (shown on the webhook after saving).
4. Going live: create a second app under Live with its own webhook, and swap
   all three values.

```env
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...
PAYPAL_SANDBOX=true   # false for live
```

## Tabby (AED/SAR instalments)

1. Tabby issues keys per store environment from the Merchant Dashboard
   (DEV/Stage for testing). Keys start with `pk_test` / `sk_test`.
2. Ask your Tabby integration manager for the **merchant code**.
3. Base URL picks the region: `https://api.tabby.ai` (UAE),
   `https://api.tabby.sa` (KSA).
4. Register the webhook via their API (self-service, one call):
   `POST https://api.tabby.ai/api/v1/webhooks` with headers
   `Authorization: Bearer <secret>` and `X-Merchant-Code: <code>`,
   body `{"url": "https://<your-domain>/webhooks/tabby",
   "header": {"title": "X-Webhook-Key", "value": "<any random secret>"}}`.
   Put that same random secret in the env below.
5. Going live: finish sandbox testing, pass Tabby's QA, then use the live
   keys they issue. Test and live share the same base URL.

```env
TABBY_SECRET_KEY=sk_test_...
TABBY_MERCHANT_CODE=...
TABBY_BASE_URL=https://api.tabby.ai
TABBY_WEBHOOK_KEY=<the random secret from step 4>
```

## Tamara (AE/SA/BH/KW/OM instalments)

1. Tamara gives you a sandbox account with an **API token**, a
   **Notification token**, and portal access.
2. In the Partners Portal, Settings, General Settings, Webhooks: add
   `https://<your-domain>/webhooks/tamara` and tick the **Approved** event
   (mandatory) plus Captured. No secret to copy; Tamara signs each call with
   the notification token automatically.
3. Going live: Tamara verifies the sandbox integration, then issues
   production credentials. Switch the base URL and both tokens.

```env
TAMARA_API_TOKEN=...
TAMARA_NOTIFICATION_TOKEN=...
TAMARA_BASE_URL=https://api-sandbox.tamara.co   # live: https://api.tamara.co
```

## Fake (local development and tests only)

No account. The `fake` driver refuses to run in production. Tests get it from
`SeedsCurrencies`, which writes `payment_provider = fake` per currency row.

There is no `PAYMENTS_DEFAULT_PROVIDER` and no `payments.default` config. Routing
is decided in exactly two places: the `currencies.payment_provider` column
(AED `stripe`, GHS `paystack`, from `CurrencySeeder`) and
`payment_methods.provider` for the method the shopper picked. A blank or unknown
provider throws rather than falling back to anything.

For local AED checkout without Stripe keys, point the row at `fake` yourself:

```bash
php artisan tinker --execute='DB::table("currencies")->where("code","AED")->update(["payment_provider"=>"fake"]);'
php artisan db:seed --class=PaymentMethodSeeder   # re-assert live methods on stripe
```

Expect real Stripe keys in `.env` for anything else, otherwise
`StripeGateway` fails loudly with "Stripe is not configured (STRIPE_SECRET)".

## After any provider is configured

1. `php artisan config:clear` (or redeploy) so the new env values load.
2. Admin, Settings, Payment methods: the method row already exists (seeded).
   Turn it on. PayPal, Tabby and Tamara seed **off** until credentials exist.
3. Run one real sandbox order end to end and confirm the order flips to paid.
