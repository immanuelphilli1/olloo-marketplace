import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formsApi } from '../api'
import { images } from '../assets/images'
import type { SidebarCategoryId } from '../data/categoriesModal'
import { getCategoryPath } from '../data/shopRoutes'
import { Icon } from './Icon'
import { OllooLogo } from './OllooLogo'

type FooterLink = {
  label: string
  href?: string
  /** Links to this department's listing. */
  categoryId?: SidebarCategoryId
}

type FooterColumn = {
  heading: string
  links: FooterLink[]
}

const footerColumns: FooterColumn[] = [
  {
    heading: 'Company',
    links: [
      { label: 'About olloo', href: '/about' },
      { label: 'Affiliate, Partnership & Influencer Program' },
      { label: 'Press Releases' },
    ],
  },
  {
    heading: 'Marketplace',
    links: [
      { label: 'Electronics & Tech', categoryId: 'electronics' },
      { label: 'Fashion & Accessories', categoryId: 'fashion' },
      { label: 'Home & Garden', categoryId: 'home-garden' },
      { label: 'Construction & Tools', categoryId: 'construction' },
      { label: 'Energy & Power', categoryId: 'energy' },
    ],
  },
  {
    heading: 'Shop on olloo',
    links: [
      { label: 'Trending Products' },
      { label: 'Request Quotation' },
      { label: 'Connect with Agent' },
    ],
  },
  {
    heading: 'Policies',
    links: [
      { label: 'Warranty', href: '/warranty' },
      { label: 'Delivery', href: '/shipping-delivery' },
      { label: 'Return & Refund Policy', href: '/return-refund' },
      { label: 'Terms & Conditions', href: '/terms-of-use' },
      { label: 'Privacy Policy', href: '/privacy-policy' },
    ],
  },
  {
    heading: 'Help & support',
    links: [
      { label: 'Live Chat' },
      { label: 'Secured Payments', href: '/secure-payments' },
      { label: 'Intellectual Property', href: '/intellectual-property' },
    ],
  },
]

/**
 * Phones show one short COMPANY group instead of the five desktop columns,
 * which are far too long to scan on a small screen. Tablet and up keep the full
 * column layout.
 *
 * These are labels rather than new link objects so each link keeps a single
 * definition and its href stays in one place. The order below is the order they
 * appear on mobile, which does not match the column order (Live Chat is a
 * Customer Support link and Terms is a Terms link).
 */
const mobileFooterLinkLabels = [
  'About olloo',
  'Affiliate, Partnership & Influencer Program',
  'Live Chat',
  'Press Releases',
  'Terms & Conditions',
]

/** Resolves a label back to its configured link so the href is never duplicated. */
function findFooterLink(label: string): FooterLink | undefined {
  for (const column of footerColumns) {
    const match = column.links.find((link) => link.label === label)
    if (match) return match
  }

  return undefined
}

const mobileFooterLinks = mobileFooterLinkLabels.flatMap((label) => {
  const link = findFooterLink(label)
  return link ? [link] : []
})

const footerHeadingClass = 'text-sm font-bold text-text-inverse'
const footerLinkClass =
  'block py-1.5 text-sm font-medium text-text-inverse/65 transition-colors hover:text-text-inverse'

/**
 * One footer link. Page and department links navigate; links without a
 * destination yet stay as inert placeholders.
 */
function FooterLinkItem({ link }: { link: FooterLink }) {
  const to = link.href ?? (link.categoryId ? getCategoryPath(link.categoryId) : null)

  if (to) {
    return (
      <Link to={to} onClick={() => window.scrollTo({ top: 0 })} className={footerLinkClass}>
        {link.label}
      </Link>
    )
  }

  return (
    <a href="#" className={footerLinkClass}>
      {link.label}
    </a>
  )
}

function FooterSocialIcons() {
  return (
    <div className="flex items-center gap-2">
      {socialIcons.map((icon) => (
        <a
          key={icon.label}
          href={icon.href}
          aria-label={icon.label}
          className="flex size-9 items-center justify-center rounded-full bg-text-inverse/10 transition-colors hover:bg-brand"
          {...(icon.href.startsWith('http')
            ? { target: '_blank', rel: 'noopener noreferrer' }
            : {})}
        >
          {/* The glyphs are dark-filled SVGs, so they are inverted for the dark footer. */}
          <Icon src={icon.src} className="size-4.5 brightness-0 invert" />
        </a>
      ))}
    </div>
  )
}

const socialIcons = [
  { src: images.footer.facebook, label: 'Facebook', href: 'https://www.facebook.com/share/1C4ibsbyew/' },
  {
    src: images.footer.instagram,
    label: 'Instagram',
    href: 'https://instagram.com/hcomall?rpxt=MXFjOXJtZXZlN25tbw%3D%3D',
  },
  { src: images.footer.tiktok, label: 'TikTok', href: '#' },
  {
    src: images.footer.youtube,
    label: 'YouTube',
    href: 'https://youtube.com/@hcomall?si=dW7jY51QKcCS7LV_',
  },
  { src: images.footer.linkedin, label: 'LinkedIn', href: '#' },
  { src: images.footer.twitter, label: 'X', href: '#' },
]

const trustBadges = [
  images.footer.trust1,
  images.footer.trust2,
  images.footer.trust3,
  images.footer.trust4,
  images.footer.trust5,
]

const paymentIcons = [
  images.footer.applePay,
  images.footer.mastercard,
  images.footer.visa,
  images.footer.paypal,
  images.footer.tabby,
]

export function Footer() {
  const [email, setEmail] = useState('')
  const [subscribeMessage, setSubscribeMessage] = useState('')

  const handleSubscribe = async () => {
    if (!email.trim()) return

    try {
      await formsApi.subscribeNewsletter(email.trim())
      setSubscribeMessage('Subscribed successfully.')
      setEmail('')
    } catch {
      // setSubscribeMessage('Unable to subscribe right now.')
      setEmail('')
      console.log('Unable to subscribe right now.')
    }
  }

  return (
    // Bottom padding on phones clears the fixed tab bar.
    <footer className="flex w-full flex-col bg-ink pb-20 text-text-inverse lg:mt-4 lg:rounded-t-[28px] lg:pb-0">
      <div className="flex flex-col gap-6 border-b border-text-inverse/10 px-4 py-8 lg:flex-row lg:items-center lg:justify-between lg:px-16 lg:py-12">
        <div className="flex max-w-sm flex-col gap-3">
          <OllooLogo className="h-8 w-auto self-start text-text-inverse" />
          <p className="text-sm leading-relaxed text-text-inverse/65">
            Everything you love, one tap away. Shop electronics, fashion, home and more with secure
            checkout and tracked delivery.
          </p>
        </div>

        <div className="w-full lg:max-w-md">
          <p className="font-display mb-1 text-lg font-bold">Get deals in your inbox</p>
          <p className="mb-3 text-sm text-text-inverse/65">
            New arrivals, price drops and offers from olloo. Unsubscribe any time.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void handleSubscribe()
            }}
            className="flex items-center gap-2 rounded-full bg-bg-primary p-1.5"
          >
            <label className="flex min-w-0 flex-1 items-center gap-2 pl-3">
              <Icon src={images.footer.mail} className="size-5" />
              <span className="sr-only">Email address</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Your email address"
                autoComplete="email"
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-text-primary outline-none placeholder:text-text-tertiary"
              />
            </label>
            <button
              type="submit"
              className="flex h-10 shrink-0 cursor-pointer items-center rounded-full bg-accent px-5 text-sm font-bold text-accent-ink transition-transform hover:-translate-y-px"
            >
              Subscribe
            </button>
          </form>
          {subscribeMessage ? (
            <p className="mt-2 text-sm text-text-inverse/75" role="status">
              {subscribeMessage}
            </p>
          ) : null}
        </div>
      </div>

      <div className="px-4 py-8 lg:px-16 lg:py-12">
        {/* Phones: a single short group with the five links that matter. */}
        <div className="flex w-full flex-col gap-3 md:hidden">
          <p className={footerHeadingClass}>Company</p>
          <ul className="flex flex-col">
            {mobileFooterLinks.map((link) => (
              <li key={link.label}>
                <FooterLinkItem link={link} />
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <FooterSocialIcons />
          </div>
        </div>

        {/* Tablet and up: the full column layout. */}
        <div className="hidden w-full md:grid md:grid-cols-3 md:gap-y-8 lg:grid-cols-5 lg:gap-8">
          {footerColumns.map((column, index) => (
            <div key={column.heading} className="flex min-w-0 flex-col gap-3">
              <p className={footerHeadingClass}>{column.heading}</p>
              <ul className="flex flex-col">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <FooterLinkItem link={link} />
                  </li>
                ))}
              </ul>
              {index === footerColumns.length - 1 && (
                <div className="mt-3">
                  <FooterSocialIcons />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="hidden flex-col gap-6 border-t border-text-inverse/10 px-4 py-6 lg:flex lg:flex-row lg:items-center lg:justify-between lg:px-16">
        <div className="flex items-center gap-4">
          <p className="text-sm font-semibold text-text-inverse/65">Get the app</p>
          <img alt="Download on the App Store" className="h-10 w-30" src={images.footer.appStore} />
          <img alt="Get it on Google Play" className="h-10 w-34" src={images.footer.googlePlay} />
        </div>

        <div className="flex flex-col items-end gap-2">
          <p className="text-xs font-semibold text-text-inverse/50">We accept</p>
          {/* Payment and trust marks are drawn for light backgrounds, so each
              sits on its own white chip. */}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {paymentIcons.map((icon) => (
              <span key={icon} className="flex h-8 w-11 items-center justify-center rounded-md bg-bg-primary p-1">
                <img alt="" className="max-h-full max-w-full object-contain" src={icon} />
              </span>
            ))}
            <span className="relative h-8 w-11 overflow-hidden rounded-md bg-bg-primary">
              <img alt="Tamara" className="size-full object-cover" src={images.footer.tamara} />
              <img
                alt=""
                className="absolute inset-x-[12.5%] top-[41.67%] h-[19.63%]"
                src={images.footer.tamaraIcon}
              />
            </span>
            <span className="flex h-8 w-11 items-center justify-center rounded-md bg-bg-primary">
              <img alt="Google Pay" className="h-[41.17%] w-[74.78%] object-contain" src={images.footer.googlePay} />
            </span>
            {trustBadges.map((badge) => (
              <span key={badge} className="flex h-8 items-center rounded-md bg-bg-primary px-1.5">
                <img alt="" className="h-6 object-contain" src={badge} />
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-text-inverse/10 px-4 py-5 lg:px-16">
        <p className="text-xs font-medium text-text-inverse/50">
          © {new Date().getFullYear()} olloo. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
