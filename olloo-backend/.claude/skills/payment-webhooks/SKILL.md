---
name: payment-webhooks
description: Rules for settling payments from Stripe/Paystack webhooks (routes/webhooks.php, POST /webhooks/{provider}). Use when adding or changing webhook handlers or debugging payments not marked paid.
---

## Goal
Settle payments reliably from provider webhooks with no user context.

## Steps
1. Routes stay in `routes/webhooks.php`, outside Sanctum/session middleware.
2. Resolve the payment by payment rid or provider reference from the payload/metadata.
3. Call the gateway's `verifyCharge` before marking paid.
4. Persist events idempotently on `(provider, external_event_id)`.
5. Log the verify call via `ExternalRequestLogger` (see `external-request-logging` skill).

## Gotchas
- Never read `X-Cart-Id`, bearer tokens or the staff session in a webhook.

## What didn't work
- Applying webhook state through cart/session middleware: settlements silently dropped or attributed to the wrong cart.
