# Frontend note: nested categories API changes

Categories are now an infinitely nested tree instead of two fixed levels. There is no `subcategories` table anymore. Each category has a `parent_id`, and children can have their own children without limit.

Base URL for everything below is `{{baseUrl}}` (`.../api/v1`).

## 1. `GET /categories` returns a tree

Top-level categories only, each with its full descendant tree inline.

```json
{
  "categories": [
    {
      "id": "fashion",
      "rid": "k0lz50rpxpcn",
      "label": "Fashion",
      "image": null,
      "children": [
        {
          "id": "fashion-shoes",
          "rid": "it2fwihb4f1i",
          "label": "Shoes",
          "image": "/images/categories/fashion-shoes.jpg",
          "children": [
            { "id": "fashion-shoes-sneakers", "label": "Sneakers", "image": "...", "children": [] }
          ]
        }
      ]
    }
  ]
}
```

What to change in your code:

- Render `children` recursively. Do not assume max two levels. The old `subcategories` key is gone.
- Every node carries `image` (may be `null` on top-level nodes).

### Limiting depth with `?depth=`

Pass `depth` to control how many levels of children come back. Applies to the list below, the single-category endpoint, and the panel.

- `GET /categories?depth=0` — top-level nodes with `"children": []`. Cheapest; use for simple dropdowns.
- `GET /categories?depth=1` — one level of children, grandchildren as `"children": []`.
- Omit `depth` — full tree at any depth.

Invalid values (negative, above 10, non-integer) return a `validation_error` (422).

## 2. `GET /categories/:categoryId` returns one category with its children

Use this when you only need the subtree under a particular parent instead of the whole tree.

- `GET /categories/fashion-shoes` — the Shoes node with its children (Sneakers, Formal Shoes, Sandals).
- `:categoryId` accepts a slug or rid at any level.
- Supports `?depth=` exactly like the list endpoint (`?depth=0` for the node alone).
- Inactive categories return 404.

## 3. `GET /categories/:categoryId/panel` for the nav modal

Same lookup as the single-category endpoint (slug or rid, any level), shaped for the category modal, with `?depth=` support.

```json
{
  "id": "fashion-shoes",
  "rid": "it2fwihb4f1i",
  "label": "Shoes",
  "image": "/images/categories/fashion-shoes.jpg",
  "parent": { "rid": "...", "slug": "fashion", "label": "Fashion" },
  "children": [],
  "sections": [{ "title": "Shoes", "children": [] }]
}
```

New field: `parent` (`null` for top-level). Use it for breadcrumbs.

## 4. Product filtering includes descendants

`GET /products?categoryId=fashion` now returns products in Fashion **and** every nested child (Shoes, Sneakers, Casual Wear, T-Shirts, and so on). You no longer need one request per subcategory to fill a parent listing page.

The `subcategory` query param still works as an alias. It matches a nested category by label, rid, or slug:

- `?subcategory=Sneakers`
- `?subcategory=fashion-shoes-sneakers`

Special `categoryId` values are unchanged: `all-categories`, `featured`, `new-releases`.

## 5. Product payload fields

Each product points at its most specific (leaf) category:

| Field | Meaning | Example for Street Runner Sneakers |
|-------|---------|------------------------------------|
| `categoryId` | Leaf category slug (or rid) | `fashion-shoes-sneakers` |
| `category` | Leaf category label | `Sneakers` |
| `subcategory` | Immediate parent label, empty for top-level products | `Shoes` |

If you display "Category / Subcategory" breadcrumbs, build them from the category endpoints instead of these two strings for anything deeper than one parent.

`GET /products/:product/related` now returns products in the same leaf category plus sibling categories under the same parent (for example, other Shoes when viewing Sneakers).

## 6. Current fashion tree (seeded data)

```
Fashion (fashion)
├── Men (fashion-men)
├── Women (fashion-women)
├── Kids (fashion-kids)
├── Shoes (fashion-shoes)
│   ├── Sneakers (fashion-shoes-sneakers)
│   │   ├── Running (fashion-sneakers-running)
│   │   └── Court Classics (fashion-sneakers-court)
│   ├── Formal Shoes (fashion-shoes-formal)
│   └── Sandals (fashion-shoes-sandals)
└── Casual Wear (fashion-casual-wear)
    ├── T-Shirts (fashion-casual-tshirts)
    ├── Jeans (fashion-casual-jeans)
    └── Hoodies (fashion-casual-hoodies)
```

Four-level chains also exist elsewhere to prove unbounded depth, for example
Electronics / Computers / Laptops / Gaming Laptops and Home and Garden /
Kitchen / Cookware / Non-Stick. Filtering or fetching any mid-level node
includes everything below it.

Other trees (Electronics, Home and Garden, Decor, Furniture, Accessories, Construction, Energy) are two levels deep with slugs like `electronics-headphones-audio`. New seed products: `street-runner-sneakers` and `essential-casual-tee`.

## 7. Catalog images now resolve

Seeded product and category `image` paths previously returned 404 because the files did not exist. They now ship as branded placeholders and return 200, for example:

- `/images/products/street-runner-sneakers.jpg`
- `/images/categories/fashion-shoes.jpg`

Every payload that carries an `image` path now also carries an absolute `imageUrl`
(`config('app.url')` host + path, `null` when there is no image), so you never
need to prefix hosts client-side:

- Category nodes and panel: `imageUrl` next to `image`
- Product list items, cart items, order items, search suggestions, review payloads: `imageUrl` next to `image`
- Product detail galleries: `imageUrls` array next to `images`

Treat them as temporary. They will be replaced with real photography later under the same URL shape (`/images/products/{slug}.jpg`, `/images/categories/{slug}.jpg`), so code that loads `image` URLs directly needs no change when that happens.

## 8. Quick checklist

- [ ] Category nav renders `children` recursively (any depth); nothing reads `subcategories` anymore
- [ ] Subtree-only views call `GET /categories/:categoryId`, with `?depth=` where a shallow tree is enough
- [ ] Category listing pages rely on one `categoryId` request (descendants included)
- [ ] Panel/modal works with nested slugs such as `fashion-shoes`
- [ ] Breadcrumbs use `parent` from the panel payload where needed
- [ ] Image URLs loaded as-is; no local path rewriting

Full runnable examples remain in `HandCO-API.postman_collection.json` (Catalog folder) and `flows/02-catalog-discovery.postman_flow.json`. Conventions (rids, auth, guest cart) are unchanged; see `CLIENT-DEVELOPER-GUIDE.md`.
