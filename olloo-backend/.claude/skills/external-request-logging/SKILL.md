---
name: external-request-logging
description: Log every outbound call (mail, Stripe, Paystack, geo, currency, S3) to Request History on success AND failure. Use when adding an outbound integration or when Request History is missing rows.
---

## Goal
Admin Request History shows every external call; operators filter `success=false` to find broken providers.

## Steps
1. Wrap the call and record in `finally`: `ExternalRequestLogger::logOutgoing(...)` or `::fromHttp(...)`, passing method/url/headers/body plus response (`success`, status, body) and/or `exception`.
2. Mail is wired in `AppServiceProvider::boot` to `RecordOutboundEmail`: success from `MessageSent` (`handleMessageSent`); queued failure from `JobExceptionOccurred` on `SendQueuedMailable` (`handleJobExceptionOccurred`).

## Gotchas
- `MessageSent` fires only after SMTP accepts the message; failures never emit it.
- **Never make an outbound call inside `DB::transaction`.** The log row is written on the same connection, so the provider throwing rolls the log back with everything else and Request History stays empty. Commit the pending record first, then call the provider (`CheckoutPaymentService::createCheckoutPayment`).
- A 200 is not a success. Paystack answers HTTP 200 with `status: false` for a refused charge, so transport-only `success` files the rejection as a pass. Pass `envelopeSuccessKey: 'status'` in `loggedRequest`.
- `StripeGateway` calls the REST API through `LogsProviderRequests`, not the SDK, so its calls get logged. `Webhook::constructEvent` stays on the SDK: it is local HMAC, no network. Keep `Stripe-Version: ApiVersion::CURRENT` pinned by hand.

## What didn't work
- Mail logged only on `MessageSent`: SMTP 553 rejections left Request History empty while the queue retried and `laravel.log` had the error.
- Logging Paystack inside the checkout transaction: every rejection rolled its own log row back, so the only failures you could not see were the interesting ones.
- Decorating the SDK via `ApiRequestor::setHttpClient`: process-wide static, logs pre-encoded params, and one row per internal retry. Plain REST calls through the trait are simpler to test with `Http::fake`.
