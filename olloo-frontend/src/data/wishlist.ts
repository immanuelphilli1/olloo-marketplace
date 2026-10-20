import type { Product } from './products'

export function getWishlistCategoryOptions(products: Product[]): string[] {
  return [...new Set(products.map((product) => product.category))]
}

export function filterWishlistProducts(
  products: Product[],
  activeCategory: string,
): Product[] {
  if (activeCategory === 'all') return products
  return products.filter((product) => product.category === activeCategory)
}

export const wishlistPageTitle = 'Liked items'

export { getProductKey } from './products'
