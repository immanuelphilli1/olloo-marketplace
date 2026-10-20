import { images } from '../assets/images'

export type SidebarCategoryId =
  | 'all-categories'
  | 'featured'
  | 'new-releases'
  | 'electronics'
  | 'fashion'
  | 'home-garden'
  | 'decor'
  | 'furniture'
  | 'accessories'
  | 'construction'
  | 'energy'

export type Subcategory = {
  label: string
  /** Omitted when the API sends no category image. */
  image?: string
}

/**
 * UI-only label for "show me the whole catalog, ignoring the category". It is
 * not a real backend subcategory, so it must never be forwarded as an API
 * `subcategory` param (it matches zero products) and it must not be sent as a
 * `categoryId` either - `categoryId=featured` returns only the featured items,
 * not every product.
 *
 * Defined here rather than in `catalogCategories` so the label can be listed as
 * a real subcategory entry without a circular import.
 */
export const ALL_PRODUCTS_LABEL = 'All products'

export type CategorySection = {
  title: string
  items: Subcategory[]
}

export const sidebarCategories: {
  id: SidebarCategoryId
  label: string
}[] = [
  { id: 'all-categories', label: 'All categories' },
  { id: 'featured', label: 'Featured' },
  { id: 'new-releases', label: 'New Releases' },
  { id: 'electronics', label: 'Electronics & Tech' },
  { id: 'fashion', label: 'Fashion & Accessories' },
  { id: 'home-garden', label: 'Home & Garden' },
  { id: 'decor', label: 'Decor' },
  { id: 'furniture', label: 'Furniture' },
  { id: 'accessories', label: 'Accessories' },
  { id: 'construction', label: 'Construction & Tools' },
  { id: 'energy', label: 'Energy & Power' },
]

const modalImages = images.categoriesModal.items

function buildSubcategories(labels: string[], startIndex = 0): Subcategory[] {
  return labels.map((label, index) => ({
    label,
    image: modalImages[(startIndex + index) % modalImages.length],
  }))
}

export const categorySubcategories: Record<
  Exclude<SidebarCategoryId, 'all-categories'>,
  Subcategory[]
> = {
  featured: buildSubcategories(['Best Sellers', 'Top Rated', 'Deals', ALL_PRODUCTS_LABEL], 3),
  'new-releases': buildSubcategories(
    ['Latest Arrivals', 'Just Dropped', 'Coming Soon', 'Fresh Picks', 'Limited Edition'],
    3,
  ),
  electronics: buildSubcategories(
    ['Headphones & Audio', 'Wearables', 'Webcams & Accessories', 'Laptops & Tablets', 'Gaming'],
    6,
  ),
  fashion: buildSubcategories(["Women's Dresses", 'Bags', 'Casual Wear', 'Shoes', 'Watches'], 11),
  'home-garden': buildSubcategories(
    ['Plants & Seeds', 'Garden Tools', 'Outdoor Furniture', 'Planters', 'BBQ & Outdoor'],
    1,
  ),
  decor: buildSubcategories(['Vases', 'Lamps & Lighting', 'Wall Art', 'Mirrors', 'Rugs'], 4),
  furniture: buildSubcategories(['Dining Tables', 'Sofas', 'Desks', 'Chairs', 'Beds'], 8),
  accessories: buildSubcategories(
    ['Watch Straps', 'Travel Gear', 'Tech Accessories', 'Bags', 'Phone Cases'],
    12,
  ),
  construction: buildSubcategories(
    ['Power Tools', 'Tool Storage', 'Measuring Tools', 'Hand Tools', 'Safety Equipment'],
    14,
  ),
  energy: buildSubcategories(
    ['Power Stations', 'Solar Panels', 'Smart Power Strips', 'Batteries', 'Chargers'],
    2,
  ),
}

export const categoryPanelContent: Record<SidebarCategoryId, CategorySection[]> = {
  'all-categories': [],
  featured: [
    { title: 'Featured', items: categorySubcategories.featured },
    { title: 'New Releases', items: categorySubcategories['new-releases'] },
  ],
  'new-releases': [{ title: 'New Releases', items: categorySubcategories['new-releases'] }],
  electronics: [{ title: 'Electronics & Tech', items: categorySubcategories.electronics }],
  fashion: [{ title: 'Fashion & Accessories', items: categorySubcategories.fashion }],
  'home-garden': [{ title: 'Home & Garden', items: categorySubcategories['home-garden'] }],
  decor: [{ title: 'Decor', items: categorySubcategories.decor }],
  furniture: [{ title: 'Furniture', items: categorySubcategories.furniture }],
  accessories: [{ title: 'Accessories', items: categorySubcategories.accessories }],
  construction: [{ title: 'Construction & Tools', items: categorySubcategories.construction }],
  energy: [{ title: 'Energy & Power', items: categorySubcategories.energy }],
}

export function getSubcategoryOptions(categoryId: SidebarCategoryId): string[] {
  if (categoryId === 'all-categories') {
    return Object.values(categorySubcategories).flatMap((items) =>
      items.map((item) => item.label),
    )
  }

  // The API returns leaf category ids (e.g. "home-garden-kitchen") that are not
  // keys in this static map, so an unknown id must resolve to an empty list
  // rather than throwing on a missing lookup.
  return categorySubcategories[categoryId]?.map((item) => item.label) ?? []
}

export const categoryIdByTitle = Object.fromEntries(
  sidebarCategories.map(({ id, label }) => [label, id]),
) as Record<string, SidebarCategoryId>

export const categoryIdByLabel: Record<string, SidebarCategoryId> = {
  ...categoryIdByTitle,
  Featured: 'featured',
  'Best Sellers': 'featured',
}

export function resolveCategoryId(label: string): SidebarCategoryId {
  return categoryIdByLabel[label] ?? 'featured'
}
