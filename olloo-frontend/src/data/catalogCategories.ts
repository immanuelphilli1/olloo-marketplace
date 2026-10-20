import type { ApiCategory, ApiCategoryNode, ApiSubcategory } from '../api/types'
import { resolveAssetUrl } from '../api/mappers'
import type { CategoryListingSelection } from './categoryListing'
import {
  ALL_PRODUCTS_LABEL,
  type CategorySection,
  type SidebarCategoryId,
  type Subcategory,
} from './categoriesModal'

const SPECIAL_CATEGORY_IDS = new Set<string>(['all-categories', 'featured', 'new-releases'])

const VIRTUAL_CATEGORY_LABELS: Record<string, string> = {
  'all-categories': 'All categories',
  featured: 'Featured',
  'new-releases': 'New Releases',
}

/** Sidebar / mobile list entries: virtual shortcuts plus `GET /categories` roots. */
export type CatalogSidebarEntry = {
  id: string
  label: string
}

export function buildCatalogSidebar(apiCategories: ApiCategory[] = []): CatalogSidebarEntry[] {
  return [
    { id: 'all-categories', label: VIRTUAL_CATEGORY_LABELS['all-categories'] },
    { id: 'featured', label: VIRTUAL_CATEGORY_LABELS.featured },
    { id: 'new-releases', label: VIRTUAL_CATEGORY_LABELS['new-releases'] },
    ...apiCategories.map((category) => ({
      id: getCategoryNodeId(category),
      label: category.label,
    })),
  ]
}

export function getMajorCategoryId(categoryId: SidebarCategoryId | string): SidebarCategoryId | string {
  return categoryId
}

export type CategoryPanelSectionView = CategorySection & {
  sectionId: string
}

export function isSpecialCategoryId(categoryId: string): boolean {
  return SPECIAL_CATEGORY_IDS.has(categoryId)
}

/**
 * Whether the URL segment can be mapped to a listing query without guessing.
 * Until the category tree has loaded, a child slug in `/categories/:id` is
 * indistinguishable from a bogus top-level id, which would fire the wrong
 * `GET /products` request before the real selection arrives.
 */
export function isCategoryRouteReady(
  routeCategoryId: string | undefined,
  apiCategories: ApiCategory[],
  catalogReady: boolean,
): boolean {
  if (!catalogReady) {
    return false
  }

  if (!routeCategoryId || routeCategoryId === 'all-categories') {
    return true
  }

  if (isSpecialCategoryId(routeCategoryId)) {
    return true
  }

  if (apiCategories.length === 0) {
    return false
  }

  if (findCategoryInTree(apiCategories, routeCategoryId)) {
    return true
  }

  return apiCategories.some((category) => getCategoryNodeId(category) === routeCategoryId)
}

/**
 * The category's identifier as used by the rest of the app.
 *
 * The API sends the identifier as `slug`; `id` is accepted as a fallback. Every
 * lookup in this module goes through here rather than reading `.id` directly,
 * because a node without a `slug` used to read as `undefined` and silently sent
 * every lookup down the static-placeholder path.
 */
export function getCategoryNodeId(node: ApiCategoryNode): string {
  return node.slug ?? node.id ?? ''
}

export function findApiCategory(
  categories: ApiCategory[],
  categoryId: string,
): ApiCategory | undefined {
  return categories.find((category) => getCategoryNodeId(category) === categoryId)
}

type CategoryTreeMatch = {
  node: ApiCategoryNode
  root: ApiCategory
}

/** Finds a category node anywhere in the tree and its top-level root. */
export function findCategoryInTree(
  categories: ApiCategory[],
  categoryId: string,
): CategoryTreeMatch | null {
  function search(
    nodes: ApiCategoryNode[],
    root: ApiCategory,
  ): CategoryTreeMatch | null {
    for (const node of nodes) {
      const nodeId = getCategoryNodeId(node)
      if (nodeId === categoryId) {
        return { node, root }
      }
      const childMatch = search(getApiChildNodes(node), root)
      if (childMatch) {
        return childMatch
      }
    }
    return null
  }

  for (const root of categories) {
    const rootId = getCategoryNodeId(root)
    if (rootId === categoryId) {
      return { node: root, root }
    }
    const match = search(getApiChildNodes(root), root)
    if (match) {
      return match
    }
  }

  return null
}

/**
 * Breadcrumb order: parent department, then the product's leaf category label.
 * Listing `categoryId` is always the top-level slug; `subcategoryLabel` is the
 * leaf label the API filters on.
 */
export function resolveProductListingSelection(
  productCategoryId: string,
  productSubcategory: string | undefined,
  apiCategories: ApiCategory[] = [],
): Pick<
  CategoryListingSelection,
  'categoryId' | 'categoryLabel' | 'subcategoryLabel' | 'subcategoryOptions'
> {
  const match = findCategoryInTree(apiCategories, productCategoryId)
  if (match) {
    const rootId = getCategoryNodeId(match.root)
    const nodeId = getCategoryNodeId(match.node)
    const subcategoryOptions = getSubcategoryOptions(rootId, apiCategories)

    if (rootId === nodeId) {
      const subcategoryLabel =
        productSubcategory && subcategoryOptions.includes(productSubcategory)
          ? productSubcategory
          : (subcategoryOptions[0] ?? ALL_PRODUCTS_LABEL)

      return {
        categoryId: rootId,
        categoryLabel: match.root.label,
        subcategoryLabel,
        subcategoryOptions,
      }
    }

    return {
      categoryId: rootId,
      categoryLabel: match.root.label,
      subcategoryLabel: match.node.label,
      subcategoryOptions,
    }
  }

  return {
    categoryId: productCategoryId,
    categoryLabel: getCategoryLabel(productCategoryId, apiCategories),
    subcategoryLabel: productSubcategory ?? ALL_PRODUCTS_LABEL,
    subcategoryOptions: getSubcategoryOptions(productCategoryId, apiCategories),
  }
}

/**
 * Returns a node's child nodes, preferring the API's `children` key and falling
 * back to the legacy `subcategories` key. Both are optional on the wire, so this
 * never returns undefined.
 */
export function getApiChildNodes(node: ApiCategoryNode): ApiCategoryNode[] {
  return node.children ?? node.subcategories ?? []
}

/**
 * Depth-first flatten of a category subtree, excluding the root node itself.
 * Grandchild nodes (e.g. "Gaming Laptops" under Computers > Laptops) are real
 * categories that products are assigned to, so they belong in the option list.
 */
export function flattenApiSubcategories(node: ApiCategoryNode): ApiCategoryNode[] {
  return getApiChildNodes(node).flatMap((child) => [child, ...flattenApiSubcategories(child)])
}

export function getSubcategoryLabels(category: ApiCategory): string[] {
  return flattenApiSubcategories(category).map((subcategory) => subcategory.label)
}

/** Resolves a subcategory label under a parent to the child's API slug. */
export function findSubcategorySlugByLabel(
  parentCategoryId: string,
  subcategoryLabel: string,
  apiCategories: ApiCategory[] = [],
): string | null {
  if (subcategoryLabel === ALL_PRODUCTS_LABEL) {
    return null
  }

  const parent = findApiCategory(apiCategories, parentCategoryId)
  if (!parent) {
    return null
  }

  for (const node of flattenApiSubcategories(parent)) {
    if (node.label === subcategoryLabel) {
      return getCategoryNodeId(node)
    }
  }

  return null
}

export function getSubcategoryOptions(
  categoryId: SidebarCategoryId | string,
  apiCategories: ApiCategory[] = [],
): string[] {
  if (categoryId === 'all-categories') {
    if (apiCategories.length === 0) return []
    return apiCategories.flatMap(getSubcategoryLabels)
  }

  if (isSpecialCategoryId(categoryId)) {
    if (apiCategories.length === 0) return []
    return apiCategories.flatMap((category) =>
      getApiChildNodes(category).map((child) => child.label),
    )
  }

  const apiCategory = findApiCategory(apiCategories, categoryId)
  if (apiCategory) {
    return getSubcategoryLabels(apiCategory)
  }

  return []
}

export function mapApiSubcategoriesToModalItems(
  subcategories: ApiSubcategory[],
): Subcategory[] {
  return subcategories.map((subcategory) => {
    const imageUrl = resolveAssetUrl(subcategory.imageUrl ?? subcategory.image ?? undefined)
    return {
      label: subcategory.label,
      ...(imageUrl ? { image: imageUrl } : {}),
    }
  })
}

export function getCategoryLabel(
  categoryId: SidebarCategoryId | string,
  apiCategories: ApiCategory[] = [],
): string {
  const apiCategory = findApiCategory(apiCategories, categoryId)
  if (apiCategory) {
    return apiCategory.label
  }

  return VIRTUAL_CATEGORY_LABELS[categoryId] ?? categoryId
}

/**
 * UI-only sentinel for "no subcategory filter". Re-exported from
 * `categoriesModal` so the label is defined once and can be listed as a real
 * subcategory entry (e.g. under Featured) without duplicating the string.
 */
export { ALL_PRODUCTS_LABEL }

export function buildAllCategoriesListingSelection(
  apiCategories: ApiCategory[] = [],
): CategoryListingSelection {
  return {
    categoryId: 'all-categories',
    categoryLabel: 'All categories',
    subcategoryLabel: ALL_PRODUCTS_LABEL,
    subcategoryOptions: getSubcategoryOptions('all-categories', apiCategories),
  }
}

export function buildCategoryListingSelection(
  categoryId: SidebarCategoryId | string,
  apiCategories: ApiCategory[] = [],
  subcategoryParam: string | null = null,
): CategoryListingSelection {
  if (categoryId === 'all-categories') {
    return buildAllCategoriesListingSelection(apiCategories)
  }

  const subcategoryOptions = getSubcategoryOptions(categoryId, apiCategories)
  const subcategoryLabel =
    subcategoryParam && subcategoryOptions.includes(subcategoryParam)
      ? subcategoryParam
      : ALL_PRODUCTS_LABEL

  return {
    categoryId,
    categoryLabel: getCategoryLabel(categoryId, apiCategories),
    subcategoryLabel,
    subcategoryOptions,
  }
}

function buildSectionsForCategory(
  categoryId: string,
  apiCategories: ApiCategory[],
): CategoryPanelSectionView[] {
  const apiCategory = findApiCategory(apiCategories, categoryId)
  if (!apiCategory) {
    return []
  }

  return [
    {
      title: apiCategory.label,
      sectionId: getCategoryNodeId(apiCategory),
      items: mapApiSubcategoriesToModalItems(flattenApiSubcategories(apiCategory)),
    },
  ]
}

/**
 * Sections for the virtual Featured and New Releases entries.
 *
 * Neither is a real category row on the API (`/categories/featured/panel`
 * returns 404), so there is no category to resolve a subcategory against. Their
 * cards are therefore real API subcategories drawn from across the catalog,
 * offered as shortcuts into listings. Each one keeps its **own** owning category
 * as `sectionId`, because a label such as "Sneakers" only matches products when
 * the request also carries `categoryId=fashion` — pointing these at "featured"
 * would match nothing.
 *
 * Only the fallback list is invented; once the catalog has loaded, every label
 * and image below comes from the API.
 */
function buildDiscoverySections(
  apiCategories: ApiCategory[],
): CategoryPanelSectionView[] {
  if (apiCategories.length === 0) {
    return []
  }

  const seen = new Set<string>()
  const sections: CategoryPanelSectionView[] = []

  for (const category of apiCategories) {
    // Only the first level is offered. Grandchildren are too deep to scan as a
    // shortcut grid, and their labels repeat ("Sneakers" and "Running" both sit
    // several levels down) which would make the grid ambiguous.
    const items = getApiChildNodes(category).map((child) => {
      const imageUrl = resolveAssetUrl(child.imageUrl ?? child.image ?? undefined)
      return {
        label: child.label,
        ...(imageUrl ? { image: imageUrl } : {}),
      }
    })

    const fresh = items.filter((item) => {
      const key = item.label.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    if (fresh.length === 0) continue

    sections.push({
      title: category.label,
      sectionId: getCategoryNodeId(category),
      items: fresh,
    })
  }

  return sections
}

export function getCategoryPanelSections(
  categoryId: string,
  apiCategories: ApiCategory[] = [],
): CategoryPanelSectionView[] {
  if (categoryId === 'featured' || categoryId === 'new-releases') {
    return buildDiscoverySections(apiCategories)
  }

  if (categoryId === 'all-categories') {
    return []
  }

  return buildSectionsForCategory(categoryId, apiCategories)
}
