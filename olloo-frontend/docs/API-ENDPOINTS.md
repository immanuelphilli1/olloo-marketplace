# HandCO API Endpoints

Quick reference. See [API.md](./API.md) for full specification.

**Base URL:** `https://api.handco.example/v1`

---

## Authentication

| Method | Path |
|--------|------|
| `POST` | `/auth/check-email` |
| `POST` | `/auth/login` |
| `POST` | `/auth/register` |
| `POST` | `/auth/oauth/:provider` |
| `POST` | `/auth/logout` |
| `GET` | `/auth/me` |
| `POST` | `/auth/forgot-password` |
| `POST` | `/auth/reset-password` |
| `POST` | `/auth/refresh` |

---

## Categories & Catalog

| Method | Path |
|--------|------|
| `GET` | `/categories` |
| `GET` | `/categories/:categoryId/panel` |
| `GET` | `/products` |
| `GET` | `/products/featured` |
| `GET` | `/products/new-arrivals` |
| `GET` | `/products/:productId` |
| `GET` | `/products/:productId/related` |
| `GET` | `/products/:productId/reviews` |
| `GET` | `/products/recommendations` |

---

## Search

| Method | Path |
|--------|------|
| `GET` | `/products/search` |
| `GET` | `/search/suggestions` |

---

## Cart

| Method | Path |
|--------|------|
| `GET` | `/cart` |
| `POST` | `/cart/items` |
| `PATCH` | `/cart/items/:itemId` |
| `DELETE` | `/cart/items/:itemId` |
| `DELETE` | `/cart/items` |
| `PATCH` | `/cart/items/select-all` |
| `POST` | `/cart/items/move-to-wishlist` |
| `POST` | `/cart/merge` |

---

## Wishlist

| Method | Path |
|--------|------|
| `GET` | `/wishlist` |
| `POST` | `/wishlist/:productId` |
| `DELETE` | `/wishlist/:productId` |
| `GET` | `/wishlist/categories` |

---

## Checkout & Orders

| Method | Path |
|--------|------|
| `GET` | `/checkout/preview` |
| `POST` | `/checkout/shipping-quote` |
| `POST` | `/checkout/payment-intent` |
| `POST` | `/orders` |
| `GET` | `/orders` |
| `GET` | `/orders/:orderId` |
| `GET` | `/orders/buy-again` |
| `POST` | `/orders/:orderId/buy-again` |
| `POST` | `/orders/:orderId/return` |
| `GET` | `/orders/:orderId/tracking` |

---

## User Profile & Security

| Method | Path |
|--------|------|
| `GET` | `/users/me/profile` |
| `PATCH` | `/users/me/profile` |
| `GET` | `/users/me/security` |
| `PATCH` | `/users/me/email` |
| `PATCH` | `/users/me/phone` |
| `PATCH` | `/users/me/password` |
| `POST` | `/users/me/2fa/enable` |
| `POST` | `/users/me/2fa/disable` |
| `DELETE` | `/users/me` |

---

## Addresses

| Method | Path |
|--------|------|
| `GET` | `/addresses` |
| `POST` | `/addresses` |
| `PATCH` | `/addresses/:id` |
| `DELETE` | `/addresses/:id` |
| `PATCH` | `/addresses/:id/default` |
| `POST` | `/addresses/:id/duplicate` |
| `GET` | `/addresses/lookup/countries` |
| `GET` | `/addresses/lookup/regions` |
| `GET` | `/addresses/lookup/cities` |

---

## Payment Methods

| Method | Path |
|--------|------|
| `GET` | `/payment-methods` |
| `POST` | `/payment-methods` |
| `PATCH` | `/payment-methods/:id` |
| `DELETE` | `/payment-methods/:id` |
| `PATCH` | `/payment-methods/:id/default` |
| `GET` | `/payment-methods/networks` |

---

## Reviews

| Method | Path |
|--------|------|
| `GET` | `/reviews/waiting` |
| `GET` | `/reviews/reviewed` |
| `POST` | `/reviews` |

---

## Browsing History

| Method | Path |
|--------|------|
| `GET` | `/browsing-history` |
| `POST` | `/browsing-history` |
| `DELETE` | `/browsing-history` |
| `DELETE` | `/browsing-history/all` |

---

## Notifications

| Method | Path |
|--------|------|
| `GET` | `/notifications/settings` |
| `PATCH` | `/notifications/settings/:id` |

---

## CMS & Content

| Method | Path |
|--------|------|
| `GET` | `/content/pages/:slug` |
| `GET` | `/content/home` |
| `GET` | `/content/footer` |

---

## Newsletter

| Method | Path |
|--------|------|
| `POST` | `/newsletter/subscribe` |
| `POST` | `/newsletter/unsubscribe` |

---

## Future / Placeholder

| Method | Path |
|--------|------|
| `POST` | `/partnerships/inquiries` |
| `POST` | `/quotations` |
| `POST` | `/support/agent-requests` |

---

## Payment Webhooks (backend only)

| Event |
|-------|
| `payment_intent.succeeded` |
| `payment_intent.failed` |
| `charge.refunded` |
