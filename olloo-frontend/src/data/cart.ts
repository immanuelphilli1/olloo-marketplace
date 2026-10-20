import type { Product } from './products'

export type CartItem = {
  id: string
  /** Rid of the product this line belongs to, when the API supplies it. */
  productRid?: string
  variantRid?: string
  name: string
  variant: string
  image: string
  currency: string
  price: number
  quantity: number
  selected: boolean
  /**
   * Unit price before it moved, when the API reports a change since the item was
   * added. `POST /orders` rejects the order until the shopper has seen the new
   * price, so this drives the "price changed" highlight on the cart line.
   */
  previousPrice?: number
  /** Stock on hand. Null means made-to-order, so it never sells out. */
  stockQuantity?: number | null
  /** False when the variant cannot currently be bought. */
  available?: boolean
}

export const cartOrderSummary = {
  itemsTotal: 'AED 0',
  itemsDiscount: '- AED 0',
  subtotal: 'AED 0',
  shipping: 'AED 0',
  // Empty until the API reports a tax amount; the row is hidden while blank.
  tax: '',
  total: 'AED 0',
  paymentNote: 'Please refer to your final actual payment amount.',
  availabilityNote:
    'items availability and pricing are not guaranteed until payment is final.',
  chargeNote: 'You will not be charged until you review this order on the next page.',
}

export const checkoutLegalCopy =
  'By submitting your order, you agree to our Terms of Use and Privacy Policy.'

export const securePaymentsCopy =
  'Every payment you make on H&CO is secured with strict SSL encryption and PCI DSS data protection protocols'

export const securePrivacyCopy =
  'Protecting your privacy is important to us! Please be assured that your information will be kept secured and uncompromised. We do not sell your personal information for money and will only use your information in accordance with our privacy and cookie policy to provide and improve our services to you.'

/**
 * Confirmation copy only. The order reference, delivery window and shipping
 * address are deliberately absent: they are per-order facts read from the placed
 * order, so a sample value here would be shown as if it were real.
 */
export const orderCompletedCopy = {
  title: 'Thank you for your order!',
  description:
    'Your order has been received and is being processed. You will receive an email confirmation shortly.',
}

export const shippingSummary = {
  fee: 'AED 200',
  deliveryWindow: 'Delivery: Aug 29-Sep 20',
  courierLabel: 'Courier company:',
}

export const initialCartItems: CartItem[] = []

export function productToCartItem(product: Product): CartItem {
  const numericPrice = Number.parseFloat(product.price.replace(/[^0-9.]/g, ''))
  const currency = product.price.includes('AED') ? 'AED' : '$'

  return {
    id: product.id,
    name: product.name,
    variant: 'Standard',
    image: product.image,
    currency,
    price: Number.isNaN(numericPrice) ? 0 : numericPrice,
    quantity: 1,
    selected: true,
  }
}

export const checkoutItemCount = 0
