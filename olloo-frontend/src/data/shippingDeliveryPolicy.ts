import type { PrivacyPolicyBlock } from './privacyPolicy'

export const shippingDeliveryPolicyMeta = {
  title: 'H&CO. Shipping & Delivery Policy',
  lastUpdated: 'August 27, 2026',
} as const

export const shippingDeliveryPolicyIntro = [
  'At H&CO., we are committed to making your shopping experience simple from checkout to delivery. Our Shipping & Delivery Policy explains how orders are processed, shipped, tracked, and delivered.',
] as const

export const shippingDeliveryPolicyBlocks: PrivacyPolicyBlock[] = [
  {
    type: 'heading',
    text: '1. Order Processing',
  },
  {
    type: 'paragraph',
    text: 'Once you place an order, our team will process and prepare it for shipment.',
  },
  {
    type: 'paragraph',
    text: 'Orders are generally processed within [1–3 business days] after payment confirmation. Processing times may vary depending on product availability, order volume, holidays, weekends, and other circumstances.',
  },
  {
    type: 'paragraph',
    text: 'You will receive an order confirmation after successfully placing your order.',
  },
  {
    type: 'heading',
    text: '2. Delivery Times',
  },
  {
    type: 'paragraph',
    text: 'Estimated delivery times depend on your delivery location, shipping method, product availability, and courier service.',
  },
  {
    type: 'paragraph',
    text: 'Typical delivery estimates may include:',
  },
  {
    type: 'bullets',
    items: [
      'Local Delivery: [1–3 business days]',
      'Regional Delivery: [3–7 business days]',
      'International Delivery: [7–15 business days]',
    ],
  },
  {
    type: 'paragraph',
    text: 'Delivery estimates are provided for guidance and are not guaranteed unless expressly stated otherwise.',
  },
  {
    type: 'heading',
    text: '3. Shipping Costs',
  },
  {
    type: 'paragraph',
    text: 'Shipping charges are calculated based on factors such as:',
  },
  {
    type: 'bullets',
    items: [
      'Delivery destination',
      'Order size and weight',
      'Shipping method',
      'Product type',
      'Applicable promotions',
    ],
  },
  {
    type: 'paragraph',
    text: 'The applicable shipping cost will be displayed at checkout before you complete your purchase.',
  },
  {
    type: 'paragraph',
    text: 'From time to time, H&CO. may offer free or discounted shipping promotions.',
  },
  {
    type: 'heading',
    text: '4. Order Tracking',
  },
  {
    type: 'paragraph',
    text: 'Where tracking is available, customers will receive a tracking number or delivery update after their order has been dispatched.',
  },
  {
    type: 'paragraph',
    text: 'You can use the provided tracking information to monitor your shipment through the relevant delivery provider.',
  },
  {
    type: 'heading',
    text: '5. Delivery Address',
  },
  {
    type: 'paragraph',
    text: 'Customers are responsible for providing accurate and complete delivery information.',
  },
  {
    type: 'paragraph',
    text: 'Please carefully check your:',
  },
  {
    type: 'bullets',
    items: [
      'Full name',
      'Phone number',
      'Street or building address',
      'Apartment, unit, or office number',
      'City',
      'Postal code, where applicable',
      'Country',
    ],
  },
  {
    type: 'paragraph',
    text: 'H&CO. may not be responsible for delays or additional costs caused by incorrect or incomplete delivery information provided by the customer.',
  },
  {
    type: 'heading',
    text: '6. Delivery Attempts',
  },
  {
    type: 'paragraph',
    text: 'The delivery provider may make one or more attempts to deliver your order.',
  },
  {
    type: 'paragraph',
    text: 'If delivery cannot be completed because the recipient is unavailable, the address is incorrect, or the shipment cannot otherwise be delivered, the courier may contact you or arrange another delivery attempt.',
  },
  {
    type: 'paragraph',
    text: 'Additional charges may apply in certain circumstances.',
  },
  {
    type: 'heading',
    text: '7. International Shipping',
  },
  {
    type: 'paragraph',
    text: 'H&CO. may offer international shipping to selected countries.',
  },
  {
    type: 'paragraph',
    text: 'International orders may be subject to customs requirements, import duties, taxes, clearance fees, or other charges imposed by the destination country.',
  },
  {
    type: 'paragraph',
    text: 'Unless expressly stated otherwise at checkout, these charges may be the responsibility of the customer.',
  },
  {
    type: 'paragraph',
    text: 'Delivery times for international orders may also be affected by customs clearance and local delivery conditions.',
  },
  {
    type: 'heading',
    text: '8. Customs & Import Duties',
  },
  {
    type: 'paragraph',
    text: 'For international shipments, customs authorities may inspect packages and apply applicable duties, taxes, or fees.',
  },
  {
    type: 'paragraph',
    text: 'H&CO. does not control customs processing times or charges imposed by destination-country authorities.',
  },
  {
    type: 'paragraph',
    text: 'Customers are responsible for complying with applicable import requirements in their country.',
  },
  {
    type: 'heading',
    text: '9. Delayed Deliveries',
  },
  {
    type: 'paragraph',
    text: 'Although we work with delivery providers to ensure timely delivery, delays can occasionally occur due to circumstances outside our reasonable control, including:',
  },
  {
    type: 'bullets',
    items: [
      'Severe weather',
      'Customs delays',
      'Public holidays',
      'Transportation disruptions',
      'Incorrect delivery information',
      'High order volumes',
      'Courier delays',
      'Government restrictions',
      'Other unforeseen circumstances',
    ],
  },
  {
    type: 'paragraph',
    text: 'If your order is significantly delayed, please contact our customer service team so we can assist with tracking and investigation.',
  },
  {
    type: 'heading',
    text: '10. Lost or Missing Packages',
  },
  {
    type: 'paragraph',
    text: 'If tracking shows that your package was delivered but you cannot locate it, please first check with household members, building reception, neighbors, or other authorized delivery locations.',
  },
  {
    type: 'paragraph',
    text: 'If the package remains missing, contact H&CO. as soon as possible.',
  },
  {
    type: 'paragraph',
    text: 'We may work with the delivery provider to investigate the shipment and determine the appropriate resolution.',
  },
  {
    type: 'heading',
    text: '11. Damaged Packages',
  },
  {
    type: 'paragraph',
    text: 'If your package arrives visibly damaged, please take photographs of the packaging and product before disposing of any materials.',
  },
  {
    type: 'paragraph',
    text: 'Contact H&CO. as soon as possible and provide your order details along with photographs or other relevant evidence.',
  },
  {
    type: 'paragraph',
    text: 'We will review the situation and provide an appropriate resolution in accordance with our Return & Refund Policy and applicable law.',
  },
  {
    type: 'heading',
    text: '12. Products in the Same Order',
  },
  {
    type: 'paragraph',
    text: 'If your order contains multiple products, items may occasionally be shipped separately depending on product availability, warehouse location, size, or delivery requirements.',
  },
  {
    type: 'paragraph',
    text: 'You may therefore receive multiple packages for a single order.',
  },
  {
    type: 'heading',
    text: '13. Pre-Orders and Backordered Products',
  },
  {
    type: 'paragraph',
    text: 'Products listed as pre-order or backordered may have different shipping timelines.',
  },
  {
    type: 'paragraph',
    text: 'The estimated dispatch date will be communicated on the product page or during checkout where applicable.',
  },
  {
    type: 'paragraph',
    text: 'If an order contains both immediately available and pre-order items, H&CO. may ship the available products separately or hold the order depending on the applicable fulfillment arrangement.',
  },
  {
    type: 'heading',
    text: '14. Delivery Confirmation',
  },
  {
    type: 'paragraph',
    text: 'A delivery may be considered completed when the delivery provider records the shipment as delivered to the address provided during checkout or to an authorized recipient.',
  },
  {
    type: 'paragraph',
    text: 'Additional verification may be requested for certain orders.',
  },
  {
    type: 'heading',
    text: '15. Contact Us',
  },
  {
    type: 'paragraph',
    text: 'If you have questions about your order or delivery, please contact our customer service team.',
  },
  {
    type: 'paragraph',
    text: 'H&CO.',
  },
  {
    type: 'paragraph',
    text: 'E-commerce & Online Retail',
  },
  {
    type: 'paragraph',
    text: 'Email: [Insert customer service email]',
  },
  {
    type: 'paragraph',
    text: 'Website: [Insert official website]',
  },
  {
    type: 'paragraph',
    text: 'Business Address: [Insert registered business address]',
  },
  {
    type: 'heading',
    text: 'Our Commitment',
  },
  {
    type: 'paragraph',
    text: 'We aim to provide a reliable and convenient delivery experience from the moment you place your order until it reaches you.',
  },
]
