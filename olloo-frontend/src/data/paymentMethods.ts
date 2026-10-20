export type PaymentMethodType = 'paypal' | 'visa' | 'mobile_money'

export const paymentCountryOptions = ['Paypal', 'Visa', 'Mobile money'] as const

export type PaymentCountryOption = (typeof paymentCountryOptions)[number]

export type PaymentMethodRecord = {
  id: string
  cardholderName: string
  type: PaymentMethodType
  maskedDetail: string
  network?: string
  isDefault: boolean
}

export type PaymentMethodFormValues = {
  countryOption: PaymentCountryOption
  email: string
  cardNumber: string
  expiry: string
  cvc: string
  mobileNumber: string
  network: string
}

export const paymentSafeguardNotice = 'All data is safeguarded'

export const paymentSecurityTitle = 'H&CO protects your card information'

export const paymentSecurityBullets = [
  'H&CO follows the Payment Card Industry Data Security Standard (PCI DSS) when handling card data',
  'Card information is secure and uncompromised',
  'All data is safeguarded',
  'H&CO never sells your card information',
]

export const emptyPaymentMethodForm: PaymentMethodFormValues = {
  countryOption: 'Paypal',
  email: '',
  cardNumber: '',
  expiry: '',
  cvc: '',
  mobileNumber: '',
  network: '',
}

export function getPaymentMethodsEmptyStateMessage(): string {
  return "You don't have any saved payment methods"
}

export function countryOptionToType(option: PaymentCountryOption): PaymentMethodType {
  switch (option) {
    case 'Paypal':
      return 'paypal'
    case 'Visa':
      return 'visa'
    case 'Mobile money':
      return 'mobile_money'
    default: {
      const exhaustiveCheck: never = option
      return exhaustiveCheck
    }
  }
}

export function paymentTypeToCountryOption(type: PaymentMethodType): PaymentCountryOption {
  switch (type) {
    case 'paypal':
      return 'Paypal'
    case 'visa':
      return 'Visa'
    case 'mobile_money':
      return 'Mobile money'
    default: {
      const exhaustiveCheck: never = type
      return exhaustiveCheck
    }
  }
}

export function paymentTypeLabel(type: PaymentMethodType): string {
  switch (type) {
    case 'paypal':
      return 'Paypal'
    case 'visa':
      return 'Visa'
    case 'mobile_money':
      return 'Mobile money'
    default: {
      const exhaustiveCheck: never = type
      return exhaustiveCheck
    }
  }
}

export function maskEmail(email: string): string {
  const trimmed = email.trim()
  const atIndex = trimmed.indexOf('@')
  if (atIndex <= 0) return trimmed

  const local = trimmed.slice(0, atIndex)
  const domain = trimmed.slice(atIndex + 1)
  const dotIndex = domain.indexOf('.')

  const maskedLocal =
    local.length <= 3 ? `${local[0] ?? ''}***` : `${local.slice(0, 3)}***${local.slice(-1)}`

  if (dotIndex <= 0) return `${maskedLocal}@${domain}`

  const domainName = domain.slice(0, dotIndex)
  const domainSuffix = domain.slice(dotIndex)
  const maskedDomain =
    domainName.length <= 2
      ? `${domainName[0] ?? ''}**.${domainSuffix.slice(1)}`
      : `${domainName[0] ?? ''}**.${domainSuffix}`

  return `${maskedLocal}@${maskedDomain}`
}

export function maskCardNumber(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, '')
  if (digits.length < 4) return digits
  return `${digits.slice(0, 3)}********${digits.slice(-3)}`
}

export function maskMobileNumber(mobileNumber: string): string {
  const digits = mobileNumber.replace(/\D/g, '')
  if (digits.length < 4) return digits
  return `${digits.slice(0, 3)}********${digits.slice(-3)}`
}

export function paymentToFormValues(payment: PaymentMethodRecord): PaymentMethodFormValues {
  const countryOption = paymentTypeToCountryOption(payment.type)

  if (payment.type === 'paypal') {
    return {
      ...emptyPaymentMethodForm,
      countryOption,
      email: 'vikjunr@gmail.com',
    }
  }

  if (payment.type === 'visa') {
    return {
      ...emptyPaymentMethodForm,
      countryOption,
      cardNumber: '1140 0021 5215 4321',
      expiry: '12/2028',
      cvc: '123',
    }
  }

  return {
    ...emptyPaymentMethodForm,
    countryOption,
    mobileNumber: '054 271 7127',
    network: payment.network ?? 'MTN',
  }
}

export function formValuesToPayment(
  values: PaymentMethodFormValues,
  id: string,
  cardholderName: string,
): PaymentMethodRecord {
  const type = countryOptionToType(values.countryOption)

  let maskedDetail = ''
  switch (type) {
    case 'paypal':
      maskedDetail = maskEmail(values.email)
      break
    case 'visa':
      maskedDetail = maskCardNumber(values.cardNumber)
      break
    case 'mobile_money':
      maskedDetail = maskMobileNumber(values.mobileNumber)
      break
    default: {
      const exhaustiveCheck: never = type
      return exhaustiveCheck
    }
  }

  return {
    id,
    cardholderName,
    type,
    maskedDetail,
    network: type === 'mobile_money' ? values.network : undefined,
    isDefault: false,
  }
}
