const DEFAULT_BASE_URL = 'https://handco.craftsmanjohn.com/api/v1'

export function getApiBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE_URL
  return baseUrl.replace(/\/$/, '')
}

export function getApiOrigin(): string {
  return new URL(getApiBaseUrl()).origin
}
