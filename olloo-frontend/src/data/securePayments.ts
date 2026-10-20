import type { PrivacyPolicyBlock } from './privacyPolicy'

export const securePaymentsMeta = {
  title: 'H&CO. Secure Payments',
  lastUpdated: 'August 27, 2026',
} as const

export const securePaymentsIntro = [
  'Security You Can Trust. Confidence in Every Transaction.',
  'At H&CO., we believe a premium shopping experience begins with trust. We are committed to maintaining a secure payment environment designed to protect your transaction information and provide confidence at every stage of your purchase.',
] as const

export const securePaymentsBlocks: PrivacyPolicyBlock[] = [
  {
    type: 'heading',
    text: 'Secure Payment Infrastructure',
  },
  {
    type: 'paragraph',
    text: 'H&CO. works with trusted payment processing technologies and service providers to facilitate secure transactions. Payment information is transmitted through protected connections and processed in accordance with applicable security standards and the requirements of our payment partners.',
  },
  {
    type: 'heading',
    text: 'Protection of Payment Information',
  },
  {
    type: 'paragraph',
    text: 'We implement appropriate technical and organisational measures designed to safeguard payment-related information against unauthorised access, alteration, disclosure, or misuse.',
  },
  {
    type: 'paragraph',
    text: 'Where payment processing is handled by third-party payment providers, your payment details may be processed directly by those providers in accordance with their own security practices and privacy policies.',
  },
  {
    type: 'heading',
    text: 'Trusted Payment Methods',
  },
  {
    type: 'paragraph',
    text: 'Depending on your location and availability, H&CO. may support a range of payment options, including:',
  },
  {
    type: 'bullets',
    items: [
      'Major credit and debit cards',
      'Digital and electronic payment solutions',
      'Online payment services',
      'Other payment methods displayed during checkout',
    ],
  },
  {
    type: 'paragraph',
    text: 'Available payment methods will be clearly presented before you complete your order.',
  },
  {
    type: 'heading',
    text: 'Transaction Security & Fraud Prevention',
  },
  {
    type: 'paragraph',
    text: 'To maintain the integrity of our marketplace and protect our customers, transactions may be subject to automated or manual security checks.',
  },
  {
    type: 'paragraph',
    text: 'We may take reasonable measures to identify and prevent potentially unauthorised, suspicious, or fraudulent transactions. In certain circumstances, an order may be delayed, reviewed, declined, or cancelled where security concerns arise.',
  },
  {
    type: 'heading',
    text: 'Your Privacy Matters',
  },
  {
    type: 'paragraph',
    text: 'H&CO. respects the confidentiality of your information. We do not sell your payment information for marketing purposes. Information may be shared with authorised service providers where necessary to process payments, fulfil orders, prevent fraud, provide customer support, or comply with applicable legal obligations.',
  },
  {
    type: 'paragraph',
    text: 'For more information about how we collect, use, and protect personal information, please refer to our Privacy Policy.',
  },
  {
    type: 'heading',
    text: 'A Secure Shopping Experience',
  },
  {
    type: 'paragraph',
    text: 'From product discovery to checkout and order completion, H&CO. is committed to creating a secure, transparent, and dependable marketplace experience.',
  },
  {
    type: 'paragraph',
    text: 'Shop with confidence. Discover smarter shopping with H&CO.',
  },
]
