import type { PrivacyPolicyBlock } from './privacyPolicy'

export const returnRefundPolicyMeta = {
  title: 'H&CO. Return & Refund Policy',
  lastUpdated: 'August 27, 2026',
} as const

export const returnRefundPolicyIntro = [
  'At H&CO., we want you to be satisfied with your purchase. If you are not completely satisfied with an eligible product, we aim to make the return and refund process simple and transparent.',
  'This Return & Refund Policy explains when products can be returned, how refunds are processed, and what customers should expect when requesting a return.',
] as const

export const returnRefundPolicyBlocks: PrivacyPolicyBlock[] = [
  {
    type: 'heading',
    text: '1. Return Eligibility',
  },
  {
    type: 'paragraph',
    text: 'Customers may request a return within 1-7 days of receiving their order, subject to the conditions below.',
  },
  {
    type: 'paragraph',
    text: 'To be eligible for a return, the product generally must:',
  },
  {
    type: 'bullets',
    items: [
      'Be unused and in its original condition',
      'Be in the original packaging where applicable',
      'Include all accessories, manuals, tags, and other items supplied with the product',
      'Not show signs of damage caused by misuse, improper handling, or normal wear and tear',
      'Be accompanied by proof of purchase or a valid order number',
    ],
  },
  {
    type: 'paragraph',
    text: 'Certain products may have different return conditions due to their nature.',
  },
  {
    type: 'heading',
    text: '2. Non-Returnable Items',
  },
  {
    type: 'paragraph',
    text: 'Some products may not be eligible for return, including where permitted by applicable law:',
  },
  {
    type: 'bullets',
    items: [
      'Personalized or customized products',
      'Digital products or downloadable content once accessed',
      'Gift cards',
      'Products that are clearly marked as final sale',
      'Perishable goods',
      'Hygiene-sensitive products that have been opened or used',
      'Products sealed for health or safety reasons after the seal has been broken',
      'Products damaged through misuse or improper handling',
    ],
  },
  {
    type: 'paragraph',
    text: 'If an item is defective or does not conform to the applicable consumer-protection requirements, different rights may apply.',
  },
  {
    type: 'heading',
    text: '3. Damaged, Defective, or Incorrect Products',
  },
  {
    type: 'paragraph',
    text: 'If you receive a product that is damaged, defective, incomplete, or different from what you ordered, please contact H&CO. as soon as reasonably possible.',
  },
  {
    type: 'paragraph',
    text: 'To help us resolve the issue quickly, you may be asked to provide:',
  },
  {
    type: 'bullets',
    items: [
      'Your order number',
      'A description of the issue',
      'Photographs or videos of the product and packaging',
      'Relevant delivery information',
    ],
  },
  {
    type: 'paragraph',
    text: 'Depending on the circumstances, H&CO. may offer a replacement, repair, refund, partial refund, or another appropriate solution.',
  },
  {
    type: 'heading',
    text: '4. How to Request a Return',
  },
  {
    type: 'paragraph',
    text: 'To request a return:',
  },
  {
    type: 'paragraph',
    text: 'Step 1 — Contact Us',
  },
  {
    type: 'paragraph',
    text: 'Contact H&CO. through our official customer service channel and provide your order number and reason for the return.',
  },
  {
    type: 'paragraph',
    text: 'Step 2 — Receive Return Instructions',
  },
  {
    type: 'paragraph',
    text: 'If your return is approved, we will provide instructions regarding where and how to send the product.',
  },
  {
    type: 'paragraph',
    text: 'Step 3 — Package the Product',
  },
  {
    type: 'paragraph',
    text: 'Securely package the item to help prevent damage during transportation.',
  },
  {
    type: 'paragraph',
    text: 'Step 4 — Send the Product',
  },
  {
    type: 'paragraph',
    text: 'Return the product using the shipping method or carrier specified by H&CO., where applicable.',
  },
  {
    type: 'paragraph',
    text: 'Step 5 — Inspection',
  },
  {
    type: 'paragraph',
    text: 'Once received, the returned product may be inspected to determine whether it meets the applicable return conditions.',
  },
  {
    type: 'heading',
    text: '5. Return Shipping Costs',
  },
  {
    type: 'paragraph',
    text: 'Return shipping responsibility may depend on the reason for the return.',
  },
  {
    type: 'paragraph',
    text: 'Where the product is defective, damaged upon arrival, incorrect, or otherwise subject to a remedy under applicable law, H&CO. may cover reasonable return shipping costs.',
  },
  {
    type: 'paragraph',
    text: 'For voluntary returns, customers may be responsible for return shipping costs unless otherwise stated at the time of purchase.',
  },
  {
    type: 'paragraph',
    text: 'Shipping fees may be non-refundable for certain voluntary returns, subject to applicable law.',
  },
  {
    type: 'heading',
    text: '6. Refunds',
  },
  {
    type: 'paragraph',
    text: 'Once an eligible return has been received and approved, H&CO. will initiate the applicable refund.',
  },
  {
    type: 'paragraph',
    text: 'Refunds are generally issued to the original payment method unless otherwise agreed or required by applicable law.',
  },
  {
    type: 'paragraph',
    text: 'Depending on your payment provider or financial institution, it may take additional business days for the refunded amount to appear in your account.',
  },
  {
    type: 'heading',
    text: '7. Partial Refunds',
  },
  {
    type: 'paragraph',
    text: 'In certain circumstances, H&CO. may issue a partial refund where appropriate, including when:',
  },
  {
    type: 'bullets',
    items: [
      'Only part of an order is returned',
      'A product has a minor issue and the customer agrees to keep it',
      'A discount or promotional offer affects the refund calculation',
      'Only certain items within a bundle are eligible for return',
    ],
  },
  {
    type: 'paragraph',
    text: 'The amount of any partial refund will depend on the circumstances and applicable terms.',
  },
  {
    type: 'heading',
    text: '8. Exchanges',
  },
  {
    type: 'paragraph',
    text: 'Where available, customers may request an exchange for an eligible product.',
  },
  {
    type: 'paragraph',
    text: 'Exchanges may be subject to product availability. If the requested replacement is unavailable, H&CO. may offer a refund or another appropriate solution.',
  },
  {
    type: 'paragraph',
    text: 'For defective or incorrect products, H&CO. will determine the appropriate resolution in accordance with applicable law.',
  },
  {
    type: 'heading',
    text: '9. Order Cancellations',
  },
  {
    type: 'paragraph',
    text: 'If you wish to cancel an order, contact H&CO. as soon as possible.',
  },
  {
    type: 'paragraph',
    text: 'We will attempt to cancel the order before it is processed or shipped. Once an order has been dispatched, cancellation may no longer be possible and the customer may need to follow the applicable return procedure.',
  },
  {
    type: 'paragraph',
    text: 'Nothing in this section limits any cancellation or withdrawal rights provided by applicable law.',
  },
  {
    type: 'heading',
    text: '10. Sale and Promotional Items',
  },
  {
    type: 'paragraph',
    text: 'Products purchased during sales, promotions, or special campaigns may be subject to specific return conditions communicated at the time of purchase.',
  },
  {
    type: 'paragraph',
    text: 'Unless expressly stated otherwise, promotional or discounted products remain subject to applicable consumer rights and this policy.',
  },
  {
    type: 'heading',
    text: '11. Gifts',
  },
  {
    type: 'paragraph',
    text: 'If an eligible product was purchased as a gift, the available refund or exchange options may depend on how the original order was paid for.',
  },
  {
    type: 'paragraph',
    text: 'Refunds may generally be issued to the original purchaser or original payment method.',
  },
  {
    type: 'heading',
    text: '12. Refunds for Lost or Undelivered Orders',
  },
  {
    type: 'paragraph',
    text: 'If your order has not arrived within the expected delivery period, please contact H&CO. so we can investigate with the relevant delivery provider.',
  },
  {
    type: 'paragraph',
    text: 'Where an order is confirmed as lost, undelivered, or otherwise eligible for a remedy, H&CO. may provide a replacement or refund in accordance with applicable law and the circumstances of the order.',
  },
  {
    type: 'heading',
    text: '13. Fraudulent or Abusive Returns',
  },
  {
    type: 'paragraph',
    text: 'H&CO. reserves the right to investigate unusual, fraudulent, or abusive return activity.',
  },
  {
    type: 'paragraph',
    text: 'This may include repeated returns involving damaged or materially different products, false claims, unauthorized returns, or other activity that appears fraudulent.',
  },
  {
    type: 'paragraph',
    text: 'Any action taken will be subject to applicable law and contractual or consumer rights.',
  },
  {
    type: 'heading',
    text: '14. Consumer Rights',
  },
  {
    type: 'paragraph',
    text: 'This policy does not limit any rights or remedies that cannot legally be excluded or restricted under the laws applicable to your purchase.',
  },
  {
    type: 'paragraph',
    text: 'Where local consumer-protection laws provide additional rights, those rights will continue to apply.',
  },
  {
    type: 'heading',
    text: '15. Changes to This Policy',
  },
  {
    type: 'paragraph',
    text: 'H&CO. may update this Return & Refund Policy from time to time.',
  },
  {
    type: 'paragraph',
    text: 'Any changes will be posted on this page with an updated “Last Updated” date. The policy applicable to your purchase will generally be the version in effect at the relevant time, subject to applicable law.',
  },
  {
    type: 'heading',
    text: '16. Contact Us',
  },
  {
    type: 'paragraph',
    text: 'For return, exchange, or refund questions, please contact our customer service team.',
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
    text: 'Social media : Instagram ,fb etc',
  },
  {
    type: 'heading',
    text: 'We’re Here to Help',
  },
  {
    type: 'paragraph',
    text: 'If something isn’t right with your order, please contact us before sending a product back. Our team will guide you through the appropriate return or refund process.',
  },
]
