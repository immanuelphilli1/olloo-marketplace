import { apiRequest } from '../client'
import type {
  BuyAgainProductsResponse,
  CartResponse,
  OrderTrackingResponse,
  OrdersListResponse,
  PaymentIntentResponse,
  ApiOrderDetail,
} from '../types'

export async function listOrders(params: {
  status?: string
  search?: string
  page?: number
  limit?: number
} = {}): Promise<OrdersListResponse> {
  return apiRequest<OrdersListResponse>('/orders', { searchParams: params })
}

export async function getOrder(orderRid: string): Promise<ApiOrderDetail> {
  return apiRequest<ApiOrderDetail>(`/orders/${orderRid}`)
}

export async function getOrderTracking(orderRid: string): Promise<OrderTrackingResponse> {
  return apiRequest<OrderTrackingResponse>(`/orders/${orderRid}/tracking`)
}

/**
 * Re-adds every line of the order back to the cart, server-side. Returns the
 * resulting cart so the caller can apply it directly — the response also carries
 * a fresh `X-Cart-Id`, which the API client has already persisted.
 */
export async function buyAgainOrder(orderRid: string): Promise<CartResponse> {
  return apiRequest<CartResponse>(`/orders/${orderRid}/buy-again`, {
    method: 'POST',
    body: {},
  })
}

/**
 * Suggested repurchase products. Note this endpoint returns a `products` array
 * rather than the paged `items` shape used elsewhere in the catalog API.
 */
export async function getBuyAgainProducts(): Promise<BuyAgainProductsResponse> {
  return apiRequest<BuyAgainProductsResponse>('/orders/buy-again')
}

/**
 * The return request the backend opens.
 *
 * The endpoint answers `201` with this body, so it is returned rather than
 * discarded: `returnId`/`rid` identify the request (useful for support) and
 * `status` starts at `requested`.
 */
export type ReturnRequestResponse = {
  success: boolean
  /** Human-facing return reference. */
  returnId: string
  /** Resource rid of the return request. */
  rid: string
  status: string
}

/**
 * Opens a return request for an order.
 *
 * Only allowed after shipping or delivery, and only for returnable categories
 * inside their window — read `returnEligibility` from the order detail first.
 * Rejections arrive as `422` with `return_not_allowed` (carrying eligibility
 * details when the window rule is what blocked it) or `return_already_open`.
 */
export async function returnOrder(
  orderRid: string,
  reason: string,
): Promise<ReturnRequestResponse> {
  return apiRequest<ReturnRequestResponse>(`/orders/${orderRid}/return`, {
    method: 'POST',
    body: { reason },
  })
}

/**
 * Reopens payment for an order that is still awaiting payment.
 *
 * A failed or abandoned payment leaves the order in `pending_payment`, and the
 * backend expects `payment-intent` to be called again for the same `orderId` to
 * retry. Each attempt is a fresh user action, so it needs its own idempotency
 * key: reusing the checkout attempt's key would send the same key with a
 * different body and be rejected as `422 idempotency_key_reused`.
 */
export async function createOrderPaymentIntent(
  orderId: string,
  idempotencyKey: string,
  paymentMethodId?: string,
): Promise<PaymentIntentResponse> {
  return apiRequest<PaymentIntentResponse>('/checkout/payment-intent', {
    method: 'POST',
    body: paymentMethodId ? { orderId, paymentMethodId } : { orderId },
    idempotencyKey,
  })
}

/**
 * Cancels an order that has not been paid.
 *
 * Only scoped to unpaid orders: an order that already has a settled payment must
 * be refunded rather than cancelled, so the backend rejects anything past
 * `pending_payment`. There is no body — the order id is the whole instruction.
 *
 * Cancelling releases the stock the order was holding, which is why it is offered
 * on the unpaid orders where leaving them is a real cost.
 */
export async function cancelOrder(orderRid: string): Promise<ApiOrderDetail> {
  return apiRequest<ApiOrderDetail>(`/orders/${orderRid}/cancel`, { method: 'POST' })
}