# HandCO API

Laravel 12 ecommerce API for the H&CO storefront, plus an Inertia staff admin for products and orders.

## Stack

- Laravel 12, Sanctum bearer auth, Spatie permissions (staff)
- Stripe + Paystack payment gateways behind a shared port (`app/Payments`)
- Guest carts via `X-Cart-Id` (cart **rid**)
- Client-facing identifiers are **rids only** (never numeric DB ids)

## Quick start

```bash
cp .env.example .env
php artisan key:generate
# SQLite is default; or configure MySQL in .env
touch database/database.sqlite
php artisan migrate --seed
php artisan storage:link        # public/storage symlink
php artisan images:placeholders # generate branded placeholders for seeded catalog images
composer install
npm install && npm run build
php artisan serve
```

API base: `http://127.0.0.1:8000/api/v1`

### Demo users (from seeders)

| Email | Password | Role |
|-------|----------|------|
| `demo@handco.test` | `password` | Customer |
| `admin@handco.test` | `password` | Staff |

Staff admin URL: `http://127.0.0.1:8000/{ADMIN_PATH_PREFIX}/login`  
Default prefix: `x7k9mPq2vL5nJw` (set `ADMIN_PATH_PREFIX` in `.env`).

## Environment

| Variable | Purpose |
|----------|---------|
| `CORS_ALLOWED_ORIGINS` | Comma-separated storefront origins |
| `WEB_CLIENT_URL` | Absolute storefront URL; gateway returns bounce here with the payment reference |
| `STRIPE_RETURN_URL`, `STRIPE_CANCEL_RETURN_URL` | Where Stripe returns the shopper; paths resolve against `APP_URL` |
| `STRIPE_KEY`, `STRIPE_SECRET`, `STRIPE_WEBHOOK_SECRET` | Stripe |
| `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET` | Paystack |
| `PAYPAL_RETURN_URL`, `TABBY_RETURN_URL`, `TAMARA_RETURN_URL` | Per-provider return URLs (plus each `_CANCEL_RETURN_URL`) |
| `ADMIN_PATH_PREFIX` | Obscured admin path |
| `ADMIN_MFA_FORCED` | Require staff MFA |

Currency rows store `payment_provider` explicitly. Blank providers fail loudly (no silent Stripe fallback).

## API conventions

- Errors: `{ "error": { "code", "message", "details?" } }`
- Lists: `{ "items", "total", "page", "limit" }`
- Money: `{ "amount", "currency" }`
- Spec fields like `productId` / `addressId` are **public rid strings**
- Docs: [docs/API.md](docs/API.md), [docs/API-ENDPOINTS.md](docs/API-ENDPOINTS.md)

## Postman

Import:

1. [postman/HandCO-API.postman_collection.json](postman/HandCO-API.postman_collection.json)
2. [postman/HandCO.local.postman_environment.json](postman/HandCO.local.postman_environment.json)

See [postman/README.md](postman/README.md) for flows.

## Tests

```bash
php artisan test
```

Uses sqlite `:memory:`. `SeedsCurrencies` writes `payment_provider = fake` per currency row.

## Webhooks

`POST /webhooks/{stripe|paystack|fake}` — no customer session; settles via verify + idempotent event store.
