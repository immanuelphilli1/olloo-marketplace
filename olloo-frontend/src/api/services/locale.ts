import { apiRequest } from '../client'

export type LocaleResponse = {
  country?: {
    code?: string
  }
}

export async function getLocale(): Promise<LocaleResponse> {
  return apiRequest<LocaleResponse>('/locale', { auth: false, cart: false })
}
