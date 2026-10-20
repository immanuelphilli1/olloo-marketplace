import type { ComponentType } from 'react'
import CustomerService2FillIcon from 'remixicon-react/CustomerService2FillIcon'
import LightbulbFillIcon from 'remixicon-react/LightbulbFillIcon'
import ShieldCheckFillIcon from 'remixicon-react/ShieldCheckFillIcon'
import ShieldStarFillIcon from 'remixicon-react/ShieldStarFillIcon'
import StarSmileFillIcon from 'remixicon-react/StarSmileFillIcon'

export type AboutValue = {
  title: string
  description: string
  Icon: ComponentType<{ className?: string }>
  wide?: boolean
}

export const aboutHeroTitle = 'Where passion meets purpose.'
export const aboutHeroSubtitle =
  'We connect customers with quality products and build a shopping experience people can trust.'

export const aboutIntroParagraphs = [
  'We are redefining the way people shop online by combining quality products, convenience, style, and dependable service in one modern e-commerce destination.',
  'Our mission is simple: to make online shopping easier, more accessible, and more enjoyable for everyone. We carefully curate a diverse range of products designed to meet the needs of modern customers—from everyday essentials and lifestyle products to technology, fashion, home, and more.',
  'We understand that customers want more than just products. They want quality, value, convenience, security, and a shopping experience they can trust. That is why we are committed to providing carefully selected products, competitive pricing, straightforward ordering, and reliable customer support.',
] as const

export const aboutVisionText =
  'Our vision is to grow H&CO. into a trusted global e-commerce brand, connecting customers with products from different markets while creating a shopping experience that is modern, convenient, and accessible.'

export const aboutValues: AboutValue[] = [
  {
    title: 'Quality',
    description: 'We strive to offer products that meet high standards and provide genuine value.',
    Icon: ShieldCheckFillIcon,
  },
  {
    title: 'Customer First',
    description:
      'Customers are at the heart of everything we do. We continuously work to improve their shopping experience.',
    Icon: CustomerService2FillIcon,
  },
  {
    title: 'Convenience',
    description:
      'From discovering products to placing an order, we aim to make every step simple and effortless.',
    Icon: StarSmileFillIcon,
  },
  {
    title: 'Trust',
    description:
      'We believe lasting relationships are built through transparency, reliability, and consistent service.',
    Icon: ShieldStarFillIcon,
  },
  {
    title: 'Innovation',
    description:
      'We embrace technology and new ideas to make online shopping smarter and more enjoyable.',
    Icon: LightbulbFillIcon,
    wide: true,
  },
]

export const aboutCommitmentParagraphs = [
  'At H&CO., we are constantly evolving with the needs of our customers. We work to expand our product selection, improve our services, and create a platform where customers can shop with confidence.',
  'Whether you are looking for something practical, something new, or something that simply makes life better, H&CO. is here to help you discover it.',
] as const

/**
 * Headline figures for the "by the numbers" band.
 *
 * The counts are derived from the live catalog rather than hardcoded, so the band
 * cannot drift from the store it describes. `value` is pre-formatted because the
 * units differ per stat.
 */
export type AboutStat = {
  value: string
  label: string
}

/** Formats a count with a thousands separator, e.g. `12,400`. */
export function formatStatCount(count: number): string {
  return count.toLocaleString('en-US')
}
