export const termsOfUseMeta = {
  title: 'H&CO. Terms of Use',
  lastUpdated: 'September 30, 2026',
} as const

export const termsOfUseIntro = [
  'These Terms of Use govern your access to and use of the H&CO. website, online store, products, and services.',
  'By creating an account, browsing our catalogue, or placing an order, you agree to these terms. If you do not agree, please do not use the site.',
] as const

export type TermsOfUseBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: readonly string[] }

export const termsOfUseBlocks: TermsOfUseBlock[] = [
  { type: 'heading', text: '1. Acceptance of Terms' },
  {
    type: 'paragraph',
    text: 'By accessing or using H&CO., you confirm that you have read, understood, and agree to be bound by these Terms of Use, our Privacy Policy, and any other policies referenced here. If you do not agree with any part of these terms, you must not use the site.',
  },
  {
    type: 'paragraph',
    text: 'We may update these terms from time to time. Continued use of the site after changes are posted constitutes acceptance of the revised terms.',
  },

  { type: 'heading', text: '2. Eligibility' },
  {
    type: 'paragraph',
    text: 'You must be at least 18 years old, or the age of majority in your jurisdiction, to create an account or place an order. By doing so, you confirm you are legally able to enter into a binding contract.',
  },
  {
    type: 'paragraph',
    text: 'You may not use H&CO. if you are barred from doing so by applicable law, or if your use would infringe the rights of another person.',
  },

  { type: 'heading', text: '3. Account Registration' },
  {
    type: 'paragraph',
    text: 'Some features require an account. You agree to provide accurate, current, and complete information, and to keep it updated. You are solely responsible for activity that occurs under your account.',
  },
  {
    type: 'paragraph',
    text: 'You agree to keep your login credentials confidential and notify us promptly if you suspect any unauthorised access. We are not liable for losses caused by failure to secure your account.',
  },
  {
    type: 'paragraph',
    text: 'We may suspend or terminate accounts that we reasonably believe are used for fraudulent, abusive, or unlawful activity.',
  },

  { type: 'heading', text: '4. Products and Availability' },
  {
    type: 'paragraph',
    text: 'We aim to keep product descriptions, images, and pricing accurate. However, products may be mispriced, mis-described, or temporarily unavailable, and we reserve the right to correct errors before an order is fulfilled.',
  },
  {
    type: 'bullets',
    items: [
      'Prices are shown in the currency displayed on the site and may change without notice.',
      'We do not guarantee that every item shown will be in stock at the time of your order.',
      'Product colours and finishes may vary slightly due to screen settings and photography.',
      'We may discontinue a product at any time.',
    ],
  },
  {
    type: 'paragraph',
    text: 'Where a product is listed with a promotional or limited-time price, that price applies only while the promotion is running and may be withdrawn without notice.',
  },

  { type: 'heading', text: '5. Orders and Acceptance' },
  {
    type: 'paragraph',
    text: 'Your submission of an order is an offer to buy. A contract of sale is formed only when we accept your order and the payment is authorised. We may decline or cancel any order, including where we suspect fraud, payment failure, pricing errors, or where stock is unavailable.',
  },
  {
    type: 'paragraph',
    text: 'Where we cancel an order that has already been charged, the full amount will be refunded to your original payment method.',
  },

  { type: 'heading', text: '6. Payments' },
  {
    type: 'paragraph',
    text: 'Payments are processed by our third-party payment providers. We do not collect or store full card details on our systems; payment pages are hosted and handled by the provider.',
  },
  {
    type: 'bullets',
    items: [
      'Payment is due at the time of order, unless a provider offers a later stage such as a credit or instalment option.',
      'You must provide accurate and valid payment information.',
      'We may decline or delay your order if payment cannot be authorised.',
      'All transaction fees are shown before you confirm payment where applicable.',
    ],
  },

  { type: 'heading', text: '7. Delivery' },
  {
    type: 'paragraph',
    text: 'Delivery dates are estimates and are not guarantees. Risks of loss and title for goods pass to you when the goods are delivered. If your delivery is late, damaged, or lost in transit, please contact us as soon as possible.',
  },
  {
    type: 'paragraph',
    text: 'Our full delivery terms are set out in our Shipping & Delivery Policy, which forms part of these Terms of Use.',
  },

  { type: 'heading', text: '8. Returns and Refunds' },
  {
    type: 'paragraph',
    text: 'You may return eligible items within the period stated in our Return & Refund Policy, in their original condition and packaging. Refunds are issued to the original payment method once the return is received and inspected.',
  },
  {
    type: 'paragraph',
    text: 'Certain items may be non-returnable, including personalised goods, perishable items, and gift cards. Our Return & Refund Policy forms part of these Terms of Use.',
  },

  { type: 'heading', text: '9. Intellectual Property' },
  {
    type: 'paragraph',
    text: 'All content on this site, including text, images, graphics, logos, and product designs, is owned by H&CO. or its licensors and is protected by intellectual property laws.',
  },
  {
    type: 'paragraph',
    text: 'You may not copy, reproduce, distribute, or create derivative works from our content without prior written permission, except for personal, non-commercial use.',
  },

  { type: 'heading', text: '10. Acceptable Use' },
  {
    type: 'bullets',
    items: [
      'Do not use the site for any unlawful purpose or in breach of any regulation.',
      'Do not attempt to gain unauthorised access to any part of the site or its systems.',
      'Do not interfere with, disrupt, or place unreasonable load on the site.',
      'Do not scrape, crawl, or harvest content or data without our written permission.',
      'Do not submit reviews, content, or materials that are unlawful, misleading, defamatory, or infringe the rights of others.',
      'Do not impersonate any person or misrepresent your affiliation.',
    ],
  },

  { type: 'heading', text: '11. Third-Party Links' },
  {
    type: 'paragraph',
    text: 'Our site may contain links to third-party websites. We do not control and are not responsible for their content, products, or practices. Your use of those sites is governed by their own terms.',
  },

  { type: 'heading', text: '12. Limitation of Liability' },
  {
    type: 'paragraph',
    text: 'To the maximum extent permitted by law, H&CO. is not liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the site or any purchase made through it.',
  },
  {
    type: 'paragraph',
    text: 'Where liability cannot be excluded, our total liability for any claim relating to an order is limited to the amount you paid for that order. Nothing in these terms excludes liability for death or personal injury caused by negligence, fraud, or any other liability that cannot lawfully be excluded.',
  },

  { type: 'heading', text: '13. Indemnity' },
  {
    type: 'paragraph',
    text: 'You agree to indemnify and hold H&CO. harmless against any claim, damage, loss, or expense (including reasonable legal fees) arising from your use of the site, your breach of these terms, or your infringement of any third-party right.',
  },

  { type: 'heading', text: '14. Changes to These Terms' },
  {
    type: 'paragraph',
    text: 'We may revise these Terms of Use at any time. The date at the top of this page shows when they were last updated. Your continued use of the site after an update constitutes acceptance of the revised terms.',
  },

  { type: 'heading', text: '15. Governing Law' },
  {
    type: 'paragraph',
    text: 'These Terms of Use are governed by the laws applicable at our place of business, without regard to conflict-of-law rules. Any dispute that cannot be resolved amicably will be submitted to the competent courts of that jurisdiction.',
  },

  { type: 'heading', text: '16. Contact' },
  {
    type: 'paragraph',
    text: 'If you have any questions about these Terms of Use, please contact us through the support channels listed on our site.',
  },
]