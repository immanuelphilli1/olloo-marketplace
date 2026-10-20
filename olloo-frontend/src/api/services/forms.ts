import { apiRequest } from '../client'

/**
 * Subscribes an address. The endpoint answers `201` with `{ success, email }`
 * and resubscribes existing rows, so this is safe to call for an address that is
 * already on the list.
 */
export async function subscribeNewsletter(
  email: string,
): Promise<{ success: boolean; email: string }> {
  return apiRequest('/newsletter/subscribe', {
    method: 'POST',
    body: { email },
    auth: false,
    cart: false,
  })
}

export async function unsubscribeNewsletter(token: string): Promise<void> {
  await apiRequest('/newsletter/unsubscribe', {
    method: 'POST',
    body: { token },
    auth: false,
    cart: false,
  })
}

export async function submitPartnershipInquiry(input: {
  email: string
  name: string
  message: string
}): Promise<void> {
  await apiRequest('/partnerships/inquiries', {
    method: 'POST',
    body: input,
    auth: false,
    cart: false,
  })
}

/**
 * Requests a quotation.
 *
 * `email` and `name` are required by the endpoint, and the free-text field is
 * `message` — there is no `details`. Both are enforced here so a form cannot
 * compile against a body the API rejects with `422`.
 */
export async function submitQuotation(input: {
  email: string
  name: string
  message: string
  company?: string
  phone?: string
  /** Product rids of interest. Stored, not validated. */
  productIds?: string[]
}): Promise<void> {
  await apiRequest('/quotations', {
    method: 'POST',
    body: input,
    auth: false,
    cart: false,
  })
}

/**
 * Requests a live agent.
 *
 * `name` is required alongside `email`; `orderId` is recorded but not verified,
 * so it only helps staff if it is a real order rid.
 */
export async function submitAgentRequest(input: {
  email: string
  name: string
  message: string
  phone?: string
  orderId?: string
}): Promise<void> {
  await apiRequest('/support/agent-requests', {
    method: 'POST',
    body: input,
    auth: false,
    cart: false,
  })
}
