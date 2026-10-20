export const privacyPolicyMeta = {
  title: 'H&CO. Privacy Policy',
  lastUpdated: 'August 27, 2026',
} as const

export const privacyPolicyIntro = [
  'At H&CO., we respect your privacy and are committed to protecting the personal information you provide when using our website, online store, products, and services.',
  'This Privacy Policy explains what information we collect, how we use it, how we protect it, and the choices you have regarding your personal information.',
] as const

export type PrivacyPolicyBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: readonly string[] }

export const privacyPolicyBlocks: PrivacyPolicyBlock[] = [
  {
    type: 'heading',
    text: '1. Information We Collect',
  },
  {
    type: 'paragraph',
    text: 'When you visit or use the H&CO. website, we may collect information such as:',
  },
  {
    type: 'bullets',
    items: [
      'Your name',
      'Email address',
      'Phone number',
      'Billing and delivery address',
      'Payment and transaction information',
      'Account login information',
      'Order history',
      'Products viewed, added to your cart, or purchased',
      'Customer service communications',
      'Device and browser information',
      'IP address and approximate location',
      'Website usage and interaction information',
      'Any other information you voluntarily provide to us',
    ],
  },
  {
    type: 'paragraph',
    text: 'We only request information that is reasonably necessary to provide and improve our services.',
  },
  {
    type: 'heading',
    text: '2. How We Use Your Information',
  },
  {
    type: 'paragraph',
    text: 'H&CO. may use your information to:',
  },
  {
    type: 'bullets',
    items: [
      'Process and fulfill orders',
      'Arrange delivery and shipping',
      'Process payments',
      'Create and manage customer accounts',
      'Provide customer support',
      'Communicate with you about your orders',
      'Send important service and account notifications',
      'Improve our website, products, and services',
      'Personalize your shopping experience',
      'Detect and prevent fraud, abuse, and unauthorized activity',
      'Maintain website security',
      'Analyze website performance and customer trends',
      'Send promotional communications where permitted by applicable law',
      'Comply with legal and regulatory obligations',
    ],
  },
  {
    type: 'heading',
    text: '3. Payment Information',
  },
  {
    type: 'paragraph',
    text: 'Payments may be processed through secure third-party payment providers. H&CO. may not directly store complete payment card information on its own systems.',
  },
  {
    type: 'paragraph',
    text: 'Payment providers may collect and process your payment information according to their own privacy policies and security practices.',
  },
  {
    type: 'heading',
    text: '4. Cookies and Similar Technologies',
  },
  {
    type: 'paragraph',
    text: 'H&CO. may use cookies, pixels, analytics tools, and similar technologies to operate our website and understand how visitors use it.',
  },
  {
    type: 'paragraph',
    text: 'These technologies may help us:',
  },
  {
    type: 'bullets',
    items: [
      'Remember your preferences',
      'Keep items in your shopping cart',
      'Maintain account sessions',
      'Understand website traffic',
      'Improve website functionality',
      'Measure marketing performance',
      'Provide relevant content and advertising where permitted',
    ],
  },
  {
    type: 'paragraph',
    text: 'You may be able to manage or disable cookies through your browser settings. Some website features may not function properly if certain cookies are disabled.',
  },
  {
    type: 'heading',
    text: '5. Sharing Your Information',
  },
  {
    type: 'paragraph',
    text: 'We do not sell your personal information simply because you shop with H&CO.',
  },
  {
    type: 'paragraph',
    text: 'We may share necessary information with trusted service providers that help us operate our business, including:',
  },
  {
    type: 'bullets',
    items: [
      'Payment processors',
      'Delivery and logistics companies',
      'E-commerce and technology providers',
      'Website hosting providers',
      'Analytics and security providers',
      'Customer service providers',
      'Marketing service providers, where applicable',
    ],
  },
  {
    type: 'paragraph',
    text: 'We may also disclose information when required by law, legal process, court order, or governmental authority, or when reasonably necessary to protect the rights, safety, property, or security of H&CO., our customers, or others.',
  },
  {
    type: 'heading',
    text: '6. Third-Party Services',
  },
  {
    type: 'paragraph',
    text: 'Our website may contain links to or integrate with third-party websites, applications, payment services, social media platforms, or other services.',
  },
  {
    type: 'paragraph',
    text: 'H&CO. is not responsible for the privacy practices of third parties. We encourage you to review the privacy policies of any third-party service before providing them with personal information.',
  },
  {
    type: 'heading',
    text: '7. Data Security',
  },
  {
    type: 'paragraph',
    text: 'We take reasonable administrative, technical, and organizational measures to protect personal information against unauthorized access, loss, misuse, alteration, or disclosure.',
  },
  {
    type: 'paragraph',
    text: 'However, no online system or method of electronic transmission can be guaranteed to be completely secure. You should also take appropriate steps to protect your account information and passwords.',
  },
  {
    type: 'heading',
    text: '8. Data Retention',
  },
  {
    type: 'paragraph',
    text: 'We retain personal information only for as long as reasonably necessary for the purposes described in this Privacy Policy, including fulfilling orders, providing services, maintaining business records, resolving disputes, preventing fraud, and complying with applicable legal requirements.',
  },
  {
    type: 'paragraph',
    text: 'When information is no longer required, we may securely delete or anonymize it where appropriate.',
  },
  {
    type: 'heading',
    text: '9. Your Privacy Rights',
  },
  {
    type: 'paragraph',
    text: 'Depending on where you live and applicable privacy laws, you may have certain rights regarding your personal information, including the right to:',
  },
  {
    type: 'bullets',
    items: [
      'Request access to information we hold about you',
      'Request correction of inaccurate information',
      'Request deletion of certain personal information',
      'Request restriction of certain processing',
      'Object to certain uses of your information',
      'Withdraw consent where processing is based on consent',
      'Request a copy of certain information in a portable format',
      'Opt out of certain marketing communications',
    ],
  },
  {
    type: 'paragraph',
    text: 'Some rights may be subject to legal limitations or exceptions.',
  },
  {
    type: 'paragraph',
    text: 'To exercise a privacy right, contact H&CO. using the contact information provided on our website.',
  },
  {
    type: 'heading',
    text: '10. Marketing Communications',
  },
  {
    type: 'paragraph',
    text: 'If you choose to receive marketing communications from H&CO., we may send information about products, promotions, special offers, and other updates.',
  },
  {
    type: 'paragraph',
    text: 'You can unsubscribe from promotional emails by using the unsubscribe option included in the message or by contacting us.',
  },
  {
    type: 'paragraph',
    text: 'Even if you opt out of marketing communications, we may still send essential communications relating to your orders, account, transactions, security, or services.',
  },
  {
    type: 'heading',
    text: "11. Children's Privacy",
  },
  {
    type: 'paragraph',
    text: 'H&CO. does not knowingly collect personal information from children where prohibited by applicable law.',
  },
  {
    type: 'paragraph',
    text: 'If you believe that a child has provided personal information to us without appropriate consent, please contact us so that we can take appropriate steps to address the situation.',
  },
  {
    type: 'heading',
    text: '12. International Data Transfers',
  },
  {
    type: 'paragraph',
    text: 'Depending on where H&CO. and our service providers operate, your information may be processed or stored in countries other than the country where you live.',
  },
  {
    type: 'paragraph',
    text: 'Where required by applicable law, we will take appropriate measures to protect personal information transferred internationally.',
  },
  {
    type: 'heading',
    text: '13. Changes to This Privacy Policy',
  },
  {
    type: 'paragraph',
    text: 'H&CO. may update this Privacy Policy from time to time to reflect changes in our services, technology, business practices, or legal requirements.',
  },
  {
    type: 'paragraph',
    text: 'When we make changes, we will update the “Last Updated” date at the top of this policy. We encourage you to review this page periodically.',
  },
  {
    type: 'heading',
    text: '14. Contact Us',
  },
  {
    type: 'paragraph',
    text: 'If you have questions about this Privacy Policy, your personal information, or your privacy rights, please contact H&CO. through the official contact details provided on our website.',
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
    text: 'Email: [Insert official customer/privacy email]',
  },
  {
    type: 'paragraph',
    text: 'Website: [Insert official website]',
  },
  {
    type: 'paragraph',
    text: 'Address: [Insert registered business address]',
  },
  {
    type: 'paragraph',
    text: '⸻',
  },
  {
    type: 'paragraph',
    text: 'Important: This Privacy Policy is a general website template and should be reviewed and customized for H&CO.’s actual business operations, country of registration, payment providers, data practices, and applicable privacy laws before publication.',
  },
]
