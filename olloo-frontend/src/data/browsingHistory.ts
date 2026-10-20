import type { Product } from './products'

export type BrowsingHistoryItem = {
  id: string
  product: Product
}

export type BrowsingHistorySection = {
  id: string
  label: string
  items: BrowsingHistoryItem[]
}

export function getAllHistoryItemIds(sections: BrowsingHistorySection[]): string[] {
  return sections.flatMap((section) => section.items.map((item) => item.id))
}

export function getBrowsingHistoryEmptyStateMessage(): string {
  return 'You have not browsed any products yet'
}
