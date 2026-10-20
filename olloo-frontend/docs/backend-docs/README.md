# HandCO Postman

**Client developers:** start with [CLIENT-DEVELOPER-GUIDE.md](./CLIENT-DEVELOPER-GUIDE.md). It covers auth, guest cart, checkout, rids, and how this package maps to the storefront. Ship that guide together with this entire `postman/` folder.

## Import

**Import only these two files** (Postman → **Import**):

1. [HandCO-API.postman_collection.json](./HandCO-API.postman_collection.json)
2. [HandCO.local.postman_environment.json](./HandCO.local.postman_environment.json)

Then select environment **HandCO Local**.

Do **not** Import anything from `flows/`. Those are visual [Postman Flows](https://www.postman.com/product/flows/) canvases. The Import dialog misreads them as “DHC Project” and fails with “No requests found”. Open them via **Flows → Local View** instead (see below).

Optional local API: `php artisan serve` then `php artisan migrate:fresh --seed`.

## Conventions

- `baseUrl` = API root (`…/api/v1`)
- `webhookBaseUrl` = app origin (webhooks are not under `/api/v1`)
- Auth: collection uses Bearer `{{accessToken}}`
- Login / Register / Refresh / OAuth scripts write `accessToken` and `refreshToken` to **both** collection and environment variables (environment values shadow collection values in Postman)
- Guest cart: header `X-Cart-Id: {{cartRid}}`
- All client-facing identifiers are **rids**

## Demo credentials

| Email | Password |
|-------|----------|
| `demo@handco.test` | `password` |

## Auth tip

After Login, open **Environments → HandCO Local** and confirm `accessToken` is populated. If Me still sends an empty Bearer token, the active environment is missing or not selected.

## Flows ([Postman Flows](https://www.postman.com/product/flows/))

`postman/flows/` contains **visual Postman Flows** (Native Git `.postman_flow.json`), one canvas per journey. These are live diagrams you can open, inspect, run, and debug in Postman, not Collection Runner folders.

| File | Journey |
|------|---------|
| [01-auth-lifecycle.postman_flow.json](./flows/01-auth-lifecycle.postman_flow.json) | check-email → login → me → refresh → logout |
| [02-catalog-discovery.postman_flow.json](./flows/02-catalog-discovery.postman_flow.json) | categories → products → detail → related → reviews → search |
| [03-guest-browse-cart-merge.postman_flow.json](./flows/03-guest-browse-cart-merge.postman_flow.json) | products → add item → login → merge → get cart |
| [04-checkout-happy-path.postman_flow.json](./flows/04-checkout-happy-path.postman_flow.json) | login → cart → address → preview → shipping → payment-intent → place order |
| [05-account-management.postman_flow.json](./flows/05-account-management.postman_flow.json) | profile → address → payment method → wishlist → review |
| [06-order-aftercare.postman_flow.json](./flows/06-order-aftercare.postman_flow.json) | list orders → tracking → buy-again → return |

Each flow wires HTTP Request blocks in sequence and uses Evaluate blocks to pass `accessToken`, `productRid`, `cartRid`, and similar values between steps.

The same journeys also live under the **Flows** folder inside `HandCO-API.postman_collection.json` (Collection Runner). Prefer the visual `.postman_flow.json` files when documenting or debugging multi-step API paths.

### Open and run a visual flow (not Import)

Requires the **Postman desktop app** ([Native Git / Local View](https://learning.postman.com/docs/postman-flows/get-started/flows-native-git/)):

1. Open **Flows**
2. Switch to **Local View**
3. Connect / open the local `postman` folder (or the repo that contains `flows/`)
4. Under **Local Files**, open a flow (for example `01-auth-lifecycle.postman_flow.json`)
5. Set flow env `baseUrl` (for example `http://127.0.0.1:8000/api/v1`). Catalog flows also use `categoryRid` (seed default: `electronics`)
6. Click **Run** on the canvas

Deep link alternative (URL-encode the absolute path):

`postman://app/flows/open?filePath=/absolute/path/to/postman/flows/01-auth-lifecycle.postman_flow.json`

CLI: `postman flows run postman/flows/01-auth-lifecycle.postman_flow.json`

If you only need sequential requests without a canvas, use the **Flows** folder inside the imported `HandCO-API` collection (Collection Runner). That folder imports with the collection and does not use `flows/*.postman_flow.json`.

See the [Flows product overview](https://www.postman.com/product/flows/).

## Webhooks

Folder **Webhooks** hits `POST /webhooks/{provider}` (not under `/api/v1`). Use the **fake** provider locally after a payment-intent that returned `paymentRid`.
