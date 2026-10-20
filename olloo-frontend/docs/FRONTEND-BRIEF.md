# Storefront brief: hcomall.com changes

For the developer of the storefront (`LHDexpress/handco-web-client`). Each item says what to change, which files are involved, and which API calls to use. The API base is `/api/v1` on the same origin (`https://hcomall.com/api/v1`; dev: the API that `handco.onrender.com` points at). All ids on the wire are **rid strings**, never numeric ids.

| # | Item | API work | Needs the new API deploy |
| --- | --- | --- | --- |
| 1 | Fetch categories and products from the API, delete hardcoded data | none, endpoints exist | no |
| 2 | New favicon | none | no |
| 3 | Banner video does not autoplay | none | no |
| 4 | Remove the tags on the bottom banners | none | no |
| 5 | Banners come from the API | none, endpoint exists | no |
| 6 | "Country or residence" typo | none | no |
| 7 | Signup collects name and country of residence | `country` (required) on register, `preferredCountry` on profile | yes |
| 8 | Color and size picked separately, photos per variant | `optionGroups`, `gallery`, `imageIndex` | yes |
| 9 | SEO for home, category and product pages | server-side meta tags, sitemap | yes |
| 10 | Server-side rendering (SSR) | none; POC patch in this repo | no (needs our deploy change) |

Items 1 to 6 work against the current API today. Items 7 to 9 need the API release that contains this brief. Two API changes are not additive: register now requires `country` (item 7), and banners no longer have a `badge` field (items 4 and 5). Ship item 7 together with that API release, or signup fails with `422`.

---

## 1. Fetch categories and products from the API

Today several components render local data from `src/data/*` and `src/data/products.json`, or show it as a fallback. Remove all of it. When data is loading, show the existing loader or skeleton. When a request fails, show an empty state. Never show local placeholder products or categories.

### API calls

**Category tree.** `GET /api/v1/categories` (optional `?depth=N`; no depth means the full tree). Active categories only, in staff order (`sort_order`).

```json
{
  "categories": [
    {
      "slug": "electronics",
      "rid": "c7Hd2kLq9xPa",
      "label": "Electronics & Tech",
      "image": "/storage/uploads/categories/electronics.jpg",
      "imageUrl": "https://hcomall.com/storage/uploads/categories/electronics.jpg",
      "children": [
        { "slug": "electronics-headphones-audio", "rid": "c2Mx8nBv4ZqR", "label": "Headphones & Audio", "image": null, "imageUrl": null, "children": [] }
      ]
    }
  ]
}
```

**One category with its parent** (mega menu panel). `GET /api/v1/categories/{slug-or-rid}/panel` returns `{ slug, rid, label, imageUrl, parent: {rid, slug, label} | null, children: [...], sections: [{ title, children }] }`. It exists in `src/api/services/catalog.ts` (`getCategoryPanel`) but nothing calls it yet.

**Products.** These already exist and are already called from `CatalogContext`:

- `GET /api/v1/products/featured`
- `GET /api/v1/products/new-arrivals?limit=N`
- `GET /api/v1/products?category=&q=&sort=&page=&limit=` (list shape `{ items, total, page, limit }`)
- `GET /api/v1/products/recommendations`

### Changes, file by file

| File | Today | Change to |
| --- | --- | --- |
| `components/CategoryGridSection.tsx` | Six fixed ids (`GRID_CATEGORY_IDS`) and local images | The top-level categories from `GET /categories?depth=0`, in API order, with `imageUrl`. Staff control the order. If a category has no image, show a neutral tile, not a local photo. |
| `components/FeaturedItemsSection.tsx` | Falls back to `getHomeFeaturedProducts()` (products.json) | API list only. Hide the section when the list is empty. |
| `components/NewArrivalsSection.tsx` | Falls back to `newArrivalProducts` | API list only. Hide the section when the list is empty. |
| `components/CategoryLinksBar.tsx` | Fixed list of seven links and icons | Top-level categories from the API. "Best Sellers" and "New Releases" are product lists, not categories: keep them as fixed links. The API has no icon field. Use a default icon, or keep a small slug-to-icon map with a default for unknown slugs. |
| `components/CategoriesModal.tsx` | Sidebar from `sidebarCategories`; panels fall back to `categoryPanelContent` | Sidebar from `GET /categories`. Panel from the same tree, or from `GET /categories/{rid}/panel`. Delete `MAJOR_CATEGORY_GROUPS`: the grouping is the category tree. |
| `components/Footer.tsx` | "MARKET PLACE" column is fixed | Top-level categories from `GET /categories?depth=0`. |
| `components/CategoryListingView.tsx` | `initialProducts` from products.json | Start empty and show `ListingLoader`. |
| `CartView.tsx`, `OrderCompletedView.tsx` | `cartRecommendations` from local data | `GET /products/recommendations` only. |
| `components/AboutPageContent.tsx` | `fallbackRecommendedProducts` from local data | API only, or remove the block. |
| `data/shopRoutes.ts` | `isSidebarCategoryId` accepts only the 11 local ids, so `/categories/<new slug>` redirects home | Accept any slug. Load the category from the API and show "not found" on a 404. |

Then delete the unused local modules: `data/products.json`, `data/products.ts`, `data/categoriesModal.ts` (local lists), the static parts of `data/catalogCategories.ts` and `data/categoryListing.ts`, and the dead `parseProductRoute` / `data/productDetail.ts` code.

**Category URLs use the API `slug`** (`/categories/electronics`). Product URLs use the product `rid` (`/products/o3x90ykt4fs9`). Item 9 depends on both.

---

## 2. Favicon

In `index.html`, replace the Vite default:

```html
<link rel="icon" type="image/svg+xml" href="/assets/footer/logo.svg" />
```

Delete `public/favicon.svg` (the purple Vite logo). Nothing else references it.

---

## 3. Banner video does not autoplay

The video is the thin banner strip in `components/Nav.tsx` (lines 285 to 295), not the hero. It shows only at 1024 px and wider (`hidden lg:block`).

### Cause

1. **The file.** `public/assets/nav/banner-vid.mp4` is 38 MB, 4320 x 144, 60 fps, H.264 **level 6.0**. Many hardware decoders stop at level 5.x and 4096 px wide. Safari and some Windows and Android devices then do not play it at all.
2. **The `muted` attribute.** React sets `muted` as a DOM property only and does not write the HTML attribute. Some browsers (Safari especially) check for the attribute when they decide to allow autoplay. There is also no `play()` retry.

### Fix

1. Re-encode the file. We tested this command. The result is 0.87 MB, 2880 x 96 (2x the 48 px strip), 30 fps, level 4.0, no audio, with fast start:

   ```bash
   ffmpeg -i banner-vid.mp4 -an -vf "scale=2880:96:flags=lanczos,fps=30" \
     -c:v libx264 -profile:v main -level:v 4.0 -pix_fmt yuv420p \
     -crf 23 -preset slow -movflags +faststart banner-vid-new.mp4
   ```

   Replace `public/assets/nav/banner-vid.mp4` with the output. Give it a new file name (for example `banner-vid-v2.mp4`), because `/assets/` is cached for one year.

2. Set `muted` on the element itself, and retry `play()`:

   ```tsx
   const bannerVideoRef = useCallback((video: HTMLVideoElement | null) => {
     if (!video) return
     video.muted = true
     video.defaultMuted = true
     video.setAttribute('muted', '')
     video.play().catch(() => {
       // Autoplay refused (power saving, data saver). Try again on the first interaction.
       const retry = () => { video.play().catch(() => {}); window.removeEventListener('pointerdown', retry) }
       window.addEventListener('pointerdown', retry, { once: true })
     })
   }, [])

   <video
     ref={bannerVideoRef}
     className="size-full object-cover"
     src={images.nav.bannerVid}
     poster="/assets/nav/banner-poster.png"
     autoPlay
     loop
     muted
     playsInline
     preload="auto"
     aria-label="Advertisement"
   />
   ```

   `public/assets/nav/banner-poster.png` already exists but nothing uses it.

### What a website cannot override

iOS Low Power Mode and some battery saver modes block all autoplay. In that case the poster shows. If the client still sees a still image after this fix, ask which browser and device they use and whether a power saving mode is on.

---

## 4. Remove the tags on the bottom banners

In `components/PromoBannerSection.tsx`, delete the badge `<span>` (lines 95 to 97, the "Special Offer", "Fashion Deal" and "Home & Garden" pills). Banners from the API (item 5) have no badge field.

---

## 5. Banners come from the API

Both carousels are hardcoded today: `HeroSection.tsx` uses `images.hero.banners` and `PromoBannerSection.tsx` uses the `promoSlides` constant. Staff now manage both in the admin **Banners** page.

### API call

`GET /api/v1/placements/home` returns the active banners for the home page, in staff order. Make one call and group the items by `position`.

```json
{
  "items": [
    {
      "rid": "b3Kq8LmZx2Pw",
      "position": "hero",
      "imageUrl": "https://hcomall.com/storage/uploads/banners/autumn.jpg",
      "altText": "Autumn sale on home essentials",
      "title": null,
      "description": null,
      "buttonText": null,
      "linkUrl": "/categories/home-garden"
    },
    {
      "rid": "b9Rt4NvC7yQe",
      "position": "promo",
      "imageUrl": "https://hcomall.com/storage/uploads/banners/promo-1.jpg",
      "altText": "Limited-time offers across the store",
      "title": "Save more on the things you love.",
      "description": "Deals refreshed every week.",
      "buttonText": "Shop now",
      "linkUrl": "/search?q=deals"
    }
  ]
}
```

- `position` is `"hero"` (top carousel, `HeroSection`) or `"promo"` (bottom carousel, `PromoBannerSection`).
- Optional: `?position=hero` returns one group only.
- `linkUrl` can be a storefront path (`/categories/...`) or an absolute URL. Use the router for a path and a normal link for an absolute URL. If `linkUrl` is null, the slide is not a link.
- Use `altText` as the image `alt`. Show `title`, `description` and `buttonText` only when they are not null.
- If a position has no items, hide that carousel. Do not fall back to local images.

Delete `images.hero.banners`, `promoSlides` and the local banner images they use.

---

## 6. "Country or residence" typo

`components/YourOrdersView.tsx` line 1374, in `CountryResidenceSelect`: change "Country or residence" to "Country of residence".

---

## 7. Signup collects name and country of residence

Today `SignInModal.tsx` asks for a password only, and `src/api/services/auth.ts` fills the name from the email (`input.email.split('@')[0]`). So every new account is named after its email.

### Form

In the register step (after `POST /auth/check-email` returns `nextStep: "register"`), add two required fields above the password:

1. **Full name** (text, max 120 characters).
2. **Country of residence** (select). Load the options from `GET /api/v1/addresses/lookup/countries`, which returns `{ countries: [{ rid, code, name, phoneCode }] }`. Preselect the country from `GET /api/v1/locale` (`country.code`) when it is known.

Change the copy "Registration is easy, just fill in the password." to match the new fields.

### API call

`POST /api/v1/auth/register`

```json
{
  "email": "ama@example.com",
  "password": "Password1!",
  "password_confirmation": "Password1!",
  "fullName": "Ama Mensah",
  "country": "GH"
}
```

- `country` is **required**. Send the ISO code (`code` from the lookup). The API stores it as the shopper's preferred country. Prices and currency then follow that market.
- Do not send `displayName`. The API uses the first word of `fullName` ("Ama").
- Remove both `split('@')` fallbacks in `auth.ts`.
- Response: `201` with `{ user, accessToken, refreshToken }` (unchanged).
- Errors: `422 validation_error` with `details.fullName`, `details.country` or other field errors; `422 country_not_found` for an unknown country.

After a successful signup, fetch `GET /api/v1/locale` again and reload prices, because the currency can change with the country.

### Profile

`GET /api/v1/users/me/profile` now also returns `preferredCountry` (ISO code or `null`):

```json
{ "fullName": "Ama Mensah", "email": "ama@example.com", "initials": "AM", "displayName": "Ama", "phone": null, "rid": "u4Hq9LmZ2xPa", "preferredCountry": "GH" }
```

Initialise the "Country of residence" select in `YourOrdersView.tsx` from this value, not from session storage (`readStoredPreferredCountry`). Session storage is empty on a new device, so the select shows nothing although the account has a country. Changing it still uses `PUT /api/v1/users/me/country` with `{ "preferredCountry": "GH" }`.

Google sign-in gets the name from Google and does not ask for a country. The shopper can set it later in the profile.

---

## 8. Color and size picked separately, photos per variant

Product details page (`ProductDetailView.tsx`). The shopper selects color and size separately. Each variant can have its own photos. When the shopper selects an option, the gallery slides to the photo of that variant. The "Model Number" heading goes away; the selected variant's name becomes the title of the selection.

All the changes on the API are additive. The old keys (`images`, `imageUrls`, `modelOptions`, `variantOptions`) stay, so the live site does not break. Change to the new keys when you build this item.

### Endpoint

`GET /api/v1/products/{productRid}`

New keys in the response:

| Key | Type | Meaning |
| --- | --- | --- |
| `gallery` | `{ rid, imageUrl, variantRid }[]` | All the product photos, in display order. `variantRid` is the variant that the photo shows, or `null`. `rid` is `null` only for the cover image when the product has no gallery. |
| `optionGroups` | `{ key, label, values }[]` | The option pickers to show. `key` is `"color"` or `"size"`. Color comes first. A group is present only if at least one variant has a value for it. |
| `variants[].imageIndex` | `number \| null` | The index in `gallery` of the first photo of this variant. `null` if no photo is linked to the variant. |

`imageUrls[i]` and `gallery[i].imageUrl` are always the same photo. You can use `gallery` and stop using `imageUrls`.

#### Example: color and size

The demo product "Classic Cotton Tee" on the dev API has this shape. The rids are examples. The response below shows only the related keys.

```json
{
  "product": { "rid": "p8Kd2mQx7LaZ", "name": "Classic Cotton Tee" },
  "gallery": [
    { "rid": "g1Hs8Tq2LmNa", "imageUrl": "https://api.example/images/products/classic-cotton-tee.jpg", "variantRid": null },
    { "rid": "g2Pw4Xc9RbVe", "imageUrl": "https://api.example/images/products/classic-cotton-tee-black.jpg", "variantRid": "v2BlkM8sQwEr" },
    { "rid": "g3Kz7Yd1NfUo", "imageUrl": "https://api.example/images/products/classic-cotton-tee-white.jpg", "variantRid": "v5WhtM3dFgHj" },
    { "rid": "g4Lx5Vb6JcTi", "imageUrl": "https://api.example/images/products/classic-cotton-tee-white-large.jpg", "variantRid": "v6WhtL9kLzXc" }
  ],
  "optionGroups": [
    { "key": "color", "label": "Color", "values": ["Black", "White"] },
    { "key": "size", "label": "Size", "values": ["S", "M", "L"] }
  ],
  "variants": [
    { "rid": "v2BlkM8sQwEr", "name": "Black / M", "color": "Black", "size": "M", "isDefault": true, "inStock": true, "stockQuantity": 25, "priceMoney": { "amount": 25, "currency": "USD" }, "imageIndex": 1 },
    { "rid": "v1BlkS4aZxCv", "name": "Black / S", "color": "Black", "size": "S", "isDefault": false, "inStock": true, "stockQuantity": 25, "priceMoney": { "amount": 25, "currency": "USD" }, "imageIndex": null },
    { "rid": "v3BlkL7nMbVq", "name": "Black / L", "color": "Black", "size": "L", "isDefault": false, "inStock": true, "stockQuantity": 25, "priceMoney": { "amount": 27, "currency": "USD" }, "imageIndex": null },
    { "rid": "v4WhtS2pOiUy", "name": "White / S", "color": "White", "size": "S", "isDefault": false, "inStock": true, "stockQuantity": 25, "priceMoney": { "amount": 25, "currency": "USD" }, "imageIndex": null },
    { "rid": "v5WhtM3dFgHj", "name": "White / M", "color": "White", "size": "M", "isDefault": false, "inStock": true, "stockQuantity": 25, "priceMoney": { "amount": 25, "currency": "USD" }, "imageIndex": 2 },
    { "rid": "v6WhtL9kLzXc", "name": "White / L", "color": "White", "size": "L", "isDefault": false, "inStock": false, "stockQuantity": 0, "priceMoney": { "amount": 27, "currency": "USD" }, "imageIndex": 3 }
  ]
}
```

The default variant is always first in `variants`. Other keys on each variant (`sku`, `priceInclTaxMoney`, `handlingDays`, `deliveryQuote`) do not change.

#### Example: variants with a name only

Some products have variants with no color and no size (for example "Standard" and "Pro"). Then `optionGroups` is empty:

```json
{
  "optionGroups": [],
  "variants": [
    { "rid": "vS7tdQ1wErTy", "name": "Standard", "color": null, "size": null, "isDefault": true, "imageIndex": null },
    { "rid": "vP9roA2sDfGh", "name": "Pro", "color": null, "size": null, "isDefault": false, "imageIndex": null }
  ]
}
```

### UI behaviour

#### Pickers

1. Remove the "Model Number" heading and the `modelOptions` chip row.
2. Show the name of the selected variant as a title under the product name, for example "Black / M". This replaces "Model Number".
3. If `optionGroups` is not empty, show one chip row for each group. Use `label` as the heading and `values` as the chips, in the order given.
4. If `optionGroups` is empty and there are two or more variants, show one chip row with the heading "Option". Use `variants[].name` as the chips.
5. If there is only one variant, do not show a picker.

#### Selection state

1. At page load, select the default variant (`isDefault: true`). Set each group selection to the color and size of that variant.
2. The selected variant is the variant whose `color` and `size` are equal to the current selection. Ignore a group that the product does not have.
3. If the shopper selects a value and no variant matches the other current value, keep the new value and change the other value to the first variant that has the new value. Prefer a variant that is in stock.
4. Show a chip as disabled (not hidden) if no in-stock variant has that value together with the other current value. A disabled chip can still be selected, so the shopper can see that it is sold out.
5. Show the price, stock and delivery of the selected variant (`priceMoney`, `inStock`, `stockQuantity`, `deliveryQuote`), not of the product card.

#### Gallery

Build the gallery from `gallery[].imageUrl`. When the selection changes, set the active slide this way:

1. If the selected variant has an `imageIndex`, go to that index.
2. Else, if the shopper clicked a color chip, go to the first `gallery` entry whose variant has that color. Find the variant by `variantRid` in `variants`.
3. Else, do not move the gallery.

The shopper can still go through all the photos with the arrows and the thumbnails. A click on a thumbnail does not change the selected variant.

```ts
function slideFor(detail: ProductDetail, variant: Variant | undefined, clickedColor?: string): number | null {
  if (variant?.imageIndex != null) return variant.imageIndex
  if (clickedColor) {
    const index = detail.gallery.findIndex(
      (image) => detail.variants.find((v) => v.rid === image.variantRid)?.color === clickedColor,
    )
    if (index !== -1) return index
  }
  return null // keep the current slide
}
```

### Required change: add to cart must send the variant

Today `addToCart(product, quantity)` in `src/context/ShopContext.tsx` sends only `productId`. The API then always adds the default variant, so whatever the shopper selected is lost. You must send the selected variant rid as `variantId`.

`POST /api/v1/cart/items`

```json
{
  "productId": "p8Kd2mQx7LaZ",
  "variantId": "v5WhtM3dFgHj",
  "quantity": 1
}
```

- `variantId` must be a variant of that product. If it is not, the API returns `404` with `{ "error": { "code": "variant_not_found", "message": "Product variant not found." } }`.
- If you do not send `variantId`, the API uses the default variant. Send it always from the product page.
- A sold-out variant returns `422` with code `insufficient_stock` and `details: { "variantRid": "v6WhtL9kLzXc", "available": 0 }`. Disable "Add to cart" and "Buy now" when `inStock` is `false` for the selected variant.
- The cart keeps one line for each variant. `findCartItemForProduct` matches on `productRid` only. If a cart has two variants of one product, that function finds the wrong line. Match on `variantRid` as well.

### Admin (no frontend work)

Staff link a photo to a variant in the admin product form. In the Media section, each gallery image has a "Variant" select when the product has two or more variants. A photo can show zero or one variant. A variant can have many photos. If staff delete a variant, its photos stay in the gallery with no link.

### Test data

On the dev API (after the seed step in "Rollout"), search for "Classic Cotton Tee" (`GET /api/v1/products?q=Classic%20Cotton%20Tee`) and open it. It has two colors (Black, White) and three sizes (S, M, L). Black / M, White / M and White / L each have a photo. White / L is sold out. Size L costs more than S and M.

---

## 9. SEO for home, category and product pages

### What the backend does now

Search engines and link previews (WhatsApp, Facebook, X, Slack) often do not run JavaScript. So the server now puts the correct tags into the HTML of these pages before it sends them:

| Path | Title | Image | Structured data |
| --- | --- | --- | --- |
| `/` | `H&CO.` | none | `WebSite` |
| `/categories` | `All categories \| H&CO.` | none | none |
| `/categories/{slug}` (a rid also works) | `{Category} \| H&CO.` | category image | none |
| `/products/{rid}` | `{Product name} \| H&CO.` | first gallery image | `Product` (price, currency, stock, rating) and `BreadcrumbList` |

Each page gets `<title>`, `meta description` (from the product description, at most 160 characters), `meta robots`, `link rel="canonical"`, Open Graph (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `og:site_name`) and Twitter card tags. An unknown or hidden product or category returns HTTP **404** with the normal SPA body and `noindex`, so the app can show its own "not found" screen.

How it works: the gateway sends these four paths to Laravel. Laravel reads your published `index.html` and replaces the tags in `<head>`. Every visitor gets the same HTML (no bot detection). If Laravel fails, the gateway serves your plain `index.html`, so the shop never goes down because of this. All other paths (`/cart`, `/search`, `/account/...`) are served as before.

The backend also serves:

- `https://hcomall.com/sitemap.xml`: home, categories and every active product.
- `https://hcomall.com/robots.txt`: blocks account, cart, checkout and API paths, and points to the sitemap. Do not add a `robots.txt` to the storefront `public/` folder; the backend one wins.

### What the storefront must do

1. **Keep `index.html` simple.** Keep one `<title>`, a closing `</head>` and an empty `<div id="root"></div>`. You can keep a default `meta description` for the pages the server does not handle. On its four paths the server removes your `title`, `description`, `robots`, `og:*`, `twitter:*`, `canonical` and JSON-LD tags and writes its own. Every tag that the server writes has a `data-seo` attribute.

2. **Use the right URLs.** Category links must use the API `slug` (item 1). Product links use the product `rid`. Query strings such as `?from=home` are fine: the canonical URL drops them.

3. **Do not call `/seo` from the browser.** Crawlers and link previews load every URL fresh from the server, so the server-written `<head>` is all they read. After an in-app navigation, only the tab title needs to change. Set it from the data the page already has:

   ```tsx
   useEffect(() => {
     document.title = `${product.name} | H&CO.`
   }, [product.name])
   ```

   Do the same with a fixed title on other pages (for example `Cart | H&CO.`). Leave the `data-seo` tags alone. `GET /api/v1/seo` exists for the SSR server (section 10), which calls it server to server.

4. **Show the product name as the page `<h1>`**, and render the product description as text, not as an image.

### Deploy: nothing changes in the storefront repo (until section 10)

The storefront deploy workflow and its smoke test stay as they are. `publish-web.sh` (from the API repo) still publishes the build to `/var/www/handco/shared/web`. The API's app container reads the same folder (read only), and it reads `index.html` on every request, so a new publish shows at once on the SEO pages too. One rule keeps this working: `index.html` must keep its `</head>`. Without it, the server cannot add the tags (it logs a warning and serves the page unchanged).

### How to check

```bash
curl -s https://hcomall.com/products/<rid> | grep -E 'og:|<title|canonical'
curl -s https://hcomall.com/sitemap.xml | head
```

Then test one product URL in the Facebook Sharing Debugger and the Google Rich Results Test. Submit `https://hcomall.com/sitemap.xml` in Google Search Console.

---

## 10. Server-side rendering (SSR)

Section 9 puts the correct `<head>` into the HTML. The body is still an empty `<div id="root">` until JavaScript runs. With SSR, the server sends the full page HTML: the `<h1>`, price, variants, description and buttons are in the first response. This helps search engines that do not run JavaScript, and the page paints before the JavaScript loads.

We built and tested a **proof of concept (POC) for the product page**. It works. The patch is in this repo: [`docs/storefront-ssr-poc.patch`](storefront-ssr-poc.patch), made against storefront commit `cfca89e`. It changes 9 files: 250 lines added, 16 removed. Nothing was pushed to the storefront repo.

### How it works

1. The browser requests `/products/{rid}`.
2. The gateway sends the request to a Node server (`server/ssr.mjs`) instead of serving `index.html`.
3. The Node server calls the API **server to server**: `GET /products/{rid}` for the page data and `GET /seo?path=...` for the `<head>` tags. It forwards the shopper's IP in `X-Forwarded-For`, so prices use the shopper's currency.
4. It renders the React app to HTML with `StaticRouter` and puts three things into the built `index.html`: the `<head>` tags, the app HTML inside `<div id="root">`, and the API response as `window.__HANDCO_INITIAL_DATA__`.
5. The browser shows the HTML at once. Then `main.tsx` calls `hydrateRoot`: React attaches to the existing HTML and does not render it again. The product page starts from `window.__HANDCO_INITIAL_DATA__`, so it does not fetch the product a second time.
6. If anything fails (the API is down, a render error, or a timeout of 3 seconds), the server sends the plain `index.html`, and the app works as it does today.

Every visitor gets the same HTML. There is no bot detection.

### What the POC changed, file by file

| File | Change | Why |
| --- | --- | --- |
| `src/App.tsx` | Moved the providers and routes into a new exported `AppShell`. `App` is now `<BrowserRouter><AppShell /></BrowserRouter>`. | The server needs the app without `BrowserRouter`, because `BrowserRouter` reads `window.location`. The server wraps `AppShell` in `StaticRouter`. |
| `src/ssr/initialData.ts` (new) | `InitialData` type, `InitialDataContext`, `useInitialData()` and the `window.__HANDCO_INITIAL_DATA__` type. | One way for the server and the browser to pass the same data into the app. |
| `src/entry-server.tsx` (new) | `render(url, initialData)`: `renderToString` of `<StaticRouter><AppShell /></StaticRouter>` inside the context. | The server bundle entry. It does no fetching; the Node server fetches first. |
| `src/main.tsx` | Reads `window.__HANDCO_INITIAL_DATA__` and provides it. Calls `hydrateRoot` if `#root` has children, else `createRoot` as before. | Pages without SSR (and the SSR fallback) arrive with an empty `#root` and still work. |
| `src/pages/HomePage.tsx` | `productDetail` starts from the initial data when its `rid` equals the URL. A ref skips the first fetch in the product effect (browsing history is still recorded). | The first browser render must equal the server HTML, or hydration fails. Skipping the fetch saves a request. |
| `src/components/ProductDetailView.tsx` | `useEffect` that sets `document.title` to `{product.name} \| H&CO.`. | The tab title follows in-app navigation without a `/seo` call (section 9, step 3). |
| `server/ssr.mjs` (new) | Node HTTP server, built-in modules only (no Express). It serves `dist/client` static files, server-renders `/products/:rid`, writes the head tags and the initial data, and falls back to the plain shell. | The SSR runtime. |
| `vite.config.ts` | For the SSR build only: `ssr.noExternal: true` (bundle every dependency) and `build.copyPublicDir: false`. | The server runs from `dist/` plus `server/`, with no `node_modules`, and the server build does not copy the 78 MB `public/` folder a second time. |
| `package.json` | New scripts: `build:ssr` (client build into `dist/client`, server build into `dist/server`) and `start:ssr`. | `npm run build` is unchanged, so a static deploy still works. |

### What we did not have to change

These facts made SSR cheap. Keep them true:

- No module touches `window`, `document`, `localStorage` or `sessionStorage` at import time.
- On the product page, browser APIs are used only in effects and event handlers. Login tokens (`sessionStorage`) and the cart id are read in effects, so the server renders the logged-out page, and the browser updates the account area after hydration.
- No component reads browser state in its first render on the product page.

### Rules for code on SSR pages

Hydration fails if the browser's first render differs from the server HTML. React then throws the server HTML away and renders again, which is slower than having no SSR. On every SSR page:

1. Do not read `window`, `document`, storage, `matchMedia` or `Date.now()` during render or in a `useState` initialiser. Read them in `useEffect` and update state there.
2. Start every piece of state from the same value on the server and in the browser: a constant, or the initial data.
3. Fetch data in the Node server, pass it in `InitialData`, and skip the first client fetch when the data is present. Copy the pattern in `HomePage.tsx`.
4. Do not render random ids or times. Use `useId()` for ids.

Known places that break rule 1 when their page gets SSR:

- `NewArrivalsSection.tsx:43`: `useState(() => window.matchMedia(...).matches)`. The server renders `false` and a desktop browser `true`. Start from `false` and set the real value in the existing effect. This is needed before the home page gets SSR.
- `ShopContext.tsx:72` (`readLastOrder()`) and `NotificationsPanel.tsx:69` read storage in `useState`. They do not run on the product page today. Move the reads into effects before those components appear on an SSR page.

### What to do

1. **Apply the POC.** In the storefront repo, on a new branch:

   ```bash
   git apply /path/to/handco-api/docs/storefront-ssr-poc.patch
   ```

   If `main` moved past `cfca89e` and the patch does not apply, make the same changes by hand from the table above. They are small.

2. **Extend SSR to the home page and category pages.**
   - Add the data to `InitialData`, for example `catalog?: { categories, featured, newArrivals }`, `placements?` (item 5) and `listing?` for a category page.
   - In `server/ssr.mjs`, match `/` and `/categories/:slug`, fetch only what that page shows, and pass it in.
   - Seed `CatalogContext` and the listing hook from the initial data, and skip their first fetch. `CatalogContext` fetches every product today; an SSR page must fetch only what it shows, or every page view becomes a large API request.
   - Fix `NewArrivalsSection` (see above) before you turn on SSR for `/`.

3. **Keep `npm run build` working.** It is the fallback build and must not depend on the SSR files.

4. **Tell us when the branch is ready.** We change the deploy and the gateway (see "What we will do").

### How to test

Run the API locally (or use the dev API). Build and start the SSR server:

```bash
# Use the dev API URL in place of the local one if you do not run the API.
VITE_API_BASE_URL=http://127.0.0.1:8077/api/v1 npm run build:ssr
SSR_API_BASE_URL=http://127.0.0.1:8077/api/v1 PORT=5180 npm run start:ssr
```

If the API runs locally, add `http://127.0.0.1:5180` to its `CORS_ALLOWED_ORIGINS`, because the browser calls the API directly in this setup. In production both are on the same origin.

Then check each point. These are the checks we ran on the POC, and all passed:

1. **The HTML has the page in it.** `curl -s http://127.0.0.1:5180/products/<rid> | grep -o '<h1[^>]*>[^<]*'` shows the product name. The `<title>` is `{Product} | H&CO.`.
2. **It works without JavaScript.** In Chrome DevTools, open the command menu, run "Disable JavaScript" and reload. The product page shows with its styles, price, variants and description.
3. **No hydration errors.** Build with development React, which reports every mismatch:

   ```bash
   NODE_ENV=development VITE_API_BASE_URL=http://127.0.0.1:8077/api/v1 npx vite build --mode development --minify false --outDir dist/client
   NODE_ENV=development npx vite build --mode development --ssr src/entry-server.tsx --outDir dist/server
   ```

   Start the server, open a product page and check the console for `hydrat` messages. Do this at desktop width and at phone width (390 px). We found none.
4. **React kept the server HTML.** Production React does not always log a mismatch; it can silently render the page again. We checked this with Puppeteer: a `MutationObserver` added before the page loads keeps the first `<h1>` the HTML parser creates, and after load `document.querySelector('h1')` must be that same element. A new element means React threw the server HTML away.
5. **In-app navigation still fetches.** From a product page, open another product inside the app. The new product loads and the tab title changes.
6. **Unknown product.** `/products/nope` returns HTTP `404` with the "Page not found" title and an empty `#root`. The app then behaves as today: its product fetch fails and it returns to the home page.
7. **API down.** Start the server with `SSR_API_BASE_URL=http://127.0.0.1:9/api/v1`. Product pages return the plain shell with HTTP `200`, the server logs the error, and the app still works.
8. **No `node_modules` needed.** Copy only `dist/` and `server/` to an empty folder and start the server from there. It must work.
9. **Static build.** `npm run build` still produces a working `dist/` for the current nginx deploy.

### Server contract (what we deploy)

- Build: `npm run build:ssr`, which produces `dist/client/` and `dist/server/entry-server.js`.
- Run: `node server/ssr.mjs` on Node 22, with only `dist/` and `server/`.
- Env: `PORT` (default `5180`) and `SSR_API_BASE_URL` (absolute; the server refuses to start without it). In Docker this is the internal API address, not the public URL.
- `VITE_API_BASE_URL` is baked into the client bundle at build time, as today.
- It answers every path: static files from `dist/client`, SSR for the SSR routes, and the plain `index.html` for everything else. HTML is `no-store`; `/assets/*` is cached for one year.
- It logs SSR failures to stdout and never answers 5xx for a page. It falls back to the plain shell instead.

### What we will do (not the frontend developer)

After the storefront SSR branch is ready:

- Build the storefront as a Node service (a second Docker target) and change the storefront deploy workflow, which today only publishes static files.
- Route `/products/*` (later `/` and `/categories/*`) in the gateway to the Node service. If Node fails, fall back to the current Laravel head injection (section 9), so the meta tags survive a Node outage.
- Add the Node service's network to `TRUSTED_PROXIES`, so the API reads the shopper's IP from `X-Forwarded-For` and not the Node container's IP.

### Other findings from the POC

- Every page calls `GET /addresses` for guests and gets `401`. Call it only when the shopper is logged in.
- `mapApiProductDetail` (`src/api/mappers.ts`) falls back to `{ amount: 0, currency: 'AED' }` when `priceMoney` is missing. That would show a price of zero in the wrong currency. Treat a missing price as an error instead.

---

## Rollout

1. Items 1 to 3 and 6 can ship now. Items 4 and 5 can ship now too; the `badge` field disappears from the API in the next release and the new code does not read it.
2. Items 7 to 9 ship together with the API release that contains this brief. Item 10 ships after we change the storefront deploy and the gateway (section 10). Check with `curl -s https://hcomall.com/api/v1/seo?path=/` (200 means it is live). Release the API and the storefront close together: the old signup form fails once `country` is required.
3. To see the item 8 demo product on the dev API, run these in its app container: `php artisan db:seed --class=ProductSeeder`, then `php artisan images:placeholders`. The seeder needs the `fashion-men` category; without it, the demo product is skipped with no error.
