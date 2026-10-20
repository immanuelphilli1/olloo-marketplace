import { apiRequest } from '../client'
import type { CmsPageResponse } from '../types'

export async function getHomeContent(): Promise<Record<string, unknown>> {
  return apiRequest('/content/home', { auth: false, cart: false })
}

export async function getFooterContent(): Promise<Record<string, unknown>> {
  return apiRequest('/content/footer', { auth: false, cart: false })
}

export async function getPageContent(slug: string): Promise<CmsPageResponse> {
  return apiRequest<CmsPageResponse>(`/content/pages/${slug}`, { auth: false, cart: false })
}
