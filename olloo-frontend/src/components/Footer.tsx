import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formsApi } from '../api'
import { images } from '../assets/images'
import { resolveCategoryId, type SidebarCategoryId } from '../data/categoriesModal'
import { Icon } from './Icon'

type FooterLink = {
  label: string
  href?: string
  /** Opens the category modal for this category instead of navigating. */
  categoryId?: SidebarCategoryId
}

type FooterColumn = {
  heading: string
  links: FooterLink[]
}

const footerColumns: FooterColumn[] = [
  {
    heading: 'COMPANY',
    links: [
      { label: 'About H&CO.', href: '/about' },
      { label: 'Affiliate, Partnership & Influencer Program' },
      { label: 'Press Releases' },
    ],
  },
  {
    heading: 'MARKET PLACE',
    links: [
      { label: 'Electronics & Tech', categoryId: 'electronics' },
      { label: 'Fashion & Accessories', categoryId: 'fashion' },
      { label: 'Home & Garden', categoryId: 'home-garden' },
      { label: 'Construction & Tools', categoryId: 'construction' },
      { label: 'Energy & Power', categoryId: 'energy' },
    ],
  },
  {
    heading: 'SOURCE ON H&CO.',
    links: [
      { label: 'Trending Products' },
      { label: 'Request Quotation' },
      { label: 'Connect with Agent' },
    ],
  },
  {
    heading: 'TERMS',
    links: [
      { label: 'Warranty', href: '/warranty' },
      { label: 'Shipping & Delivery', href: '/shipping-delivery' },
      { label: 'Return & Refund Policy', href: '/return-refund' },
      { label: 'Terms & Conditions', href: '/terms-of-use' },
      { label: 'Privacy Policy', href: '/privacy-policy' },
    ],
  },
  {
    heading: 'CUSTOMER SUPPORT',
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
  'About H&CO.',
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

const footerHeadingClass = 'text-sm font-medium tracking-[-0.28px] text-text-tertiary'
const footerLinkClass =
  'block py-1.5 text-base font-medium tracking-[-0.32px] text-text-secondary hover:text-text-primary lg:py-2'
const footerLinkButtonClass =
  'block w-full cursor-pointer py-1.5 text-left text-base font-medium tracking-[-0.32px] text-text-secondary hover:text-text-primary lg:py-2'

/**
 * One footer link. Navigation, category-modal and placeholder links are all
 * resolved here so the mobile and desktop layouts cannot render them
 * differently.
 */
function FooterLinkItem({
  link,
  onCategoryClick,
}: {
  link: FooterLink
  onCategoryClick?: (link: FooterLink) => void
}) {
  if (link.href) {
    return (
      <Link to={link.href} className={footerLinkClass}>
        {link.label}
      </Link>
    )
  }

  if (link.categoryId && onCategoryClick) {
    return (
      <button
        type="button"
        onClick={() => onCategoryClick(link)}
        className={footerLinkButtonClass}
      >
        {link.label}
      </button>
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
    <div className="flex items-center gap-4 lg:gap-1 xl:gap-4">
      {socialIcons.map((icon) => (
        <a
          key={icon.label}
          href={icon.href}
          aria-label={icon.label}
          {...(icon.href.startsWith('http')
            ? { target: '_blank', rel: 'noopener noreferrer' }
            : {})}
        >
          <Icon src={icon.src} />
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

type FooterProps = {
  /** Opens the shared category modal on the given category (Market Place links). */
  onOpenCategories?: (categoryId: SidebarCategoryId, label: string) => void
}

export function Footer({ onOpenCategories }: FooterProps) {
  const [email, setEmail] = useState('')
  const [subscribeMessage, setSubscribeMessage] = useState('')

  // Only wired up when the modal can actually be opened, so a category link
  // falls back to a plain link instead of rendering a button that does nothing.
  const onCategoryClick = onOpenCategories
    ? (link: FooterLink) => {
        const categoryId = link.categoryId ?? resolveCategoryId(link.label)
        onOpenCategories(categoryId, link.label)
      }
    : undefined

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
    // `pb-24` reserved room for the fixed mobile tab bar. The bar sits at the
    // viewport bottom, not the page bottom, so on the final screenful the extra
    // 84px reads as dead space; `pb-16` still clears it while scrolling.
    <footer className="flex w-full flex-col pb-16 lg:pb-0">
      <div className="border border-border-primary px-4 lg:px-16">
        <div className="flex flex-col gap-8 border-x border-border-primary px-4 py-6 lg:gap-14 lg:px-6 lg:py-16">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="hidden lg:block">
            <img alt="H&CO." className="size-22" src={images.footer.logo} />
            </div>
            <div className="w-full lg:ml-auto lg:w-124">
              <p className="mb-2 text-base font-medium tracking-[-0.32px] text-text-primary lg:text-center">
                Stay updated with H&CO. newsletters and promotions
              </p>
              <div className="flex items-center gap-2 rounded-full border border-border-secondary bg-bg-primary p-1">
                <label className="flex min-w-0 flex-1 items-center gap-2 p-2">
                  <Icon src={images.footer.mail} />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Emaill"
                    className="min-w-0 flex-1 bg-transparent text-base font-medium tracking-[-0.32px] text-text-primary outline-none placeholder:text-text-tertiary"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handleSubscribe()}
                  className="btn-orange flex h-10 items-center rounded-full p-4"
                >
                  <span className="text-sm font-medium tracking-[-0.28px] text-text-inverse">
                    Subscribe
                  </span>
                </button>
              </div>
              {subscribeMessage ? (
                <p className="mt-2 text-sm tracking-[-0.28px] text-text-secondary">{subscribeMessage}</p>
              ) : null}
            </div>
          </div>

          {/* Phones: a single COMPANY group with the five links that matter. */}
          <div className="flex w-full flex-col gap-4 md:hidden">
            <p className={footerHeadingClass}>COMPANY</p>
            <ul className="flex flex-col">
              {mobileFooterLinks.map((link) => (
                <li key={link.label}>
                  <FooterLinkItem link={link} onCategoryClick={onCategoryClick} />
                </li>
              ))}
            </ul>
            <div className="mt-4 lg:mt-8">
              <FooterSocialIcons />
            </div>
          </div>

          {/* Tablet and up: the full column layout, unchanged. */}
          <div className="hidden w-full md:flex md:flex-wrap md:gap-y-6 lg:flex-nowrap lg:gap-6">
            {footerColumns.map((column, index) => (
              <div key={column.heading} className="flex min-w-0 flex-col gap-4 md:w-1/3 lg:flex-1">
                <p className={footerHeadingClass}>{column.heading}</p>
                <ul className="flex flex-col">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <FooterLinkItem link={link} onCategoryClick={onCategoryClick} />
                    </li>
                  ))}
                </ul>
                {index === footerColumns.length - 1 && (
                  <div className="mt-8 lg:mt-0">
                    <FooterSocialIcons />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden lg:block border-b border-border-primary px-4 lg:px-16">
        <div className="flex flex-col gap-6 border-x border-border-primary p-4 lg:flex-row lg:items-end lg:gap-4 lg:p-6">
          <div className="flex flex-col gap-6">
            <p className="text-base font-medium tracking-[-0.32px] text-text-secondary">
              Download the H&CO. App on
            </p>
            <div className="flex items-center gap-4">
              <img alt="Download on the App Store" className="h-10 w-30" src={images.footer.appStore} />
              <img alt="Get it on Google Play" className="h-10 w-34" src={images.footer.googlePlay} />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 lg:ml-auto lg:items-end lg:justify-end">
            <div className="flex flex-wrap items-center gap-2">
              {trustBadges.map((badge) => (
                <img key={badge} alt="" className="h-7 object-contain" src={badge} />
              ))}
            </div>
            <div className="flex flex-nowrap items-center gap-2 lg:gap-3.5">
              {paymentIcons.map((icon) => (
                <img key={icon} alt="" className="h-7 w-9 object-contain" src={icon} />
              ))}
              <div className="relative h-7 w-9 overflow-hidden rounded border border-border-primary">
                <img alt="Tamara" className="size-full object-cover" src={images.footer.tamara} />
                <img
                  alt=""
                  className="absolute inset-x-[12.5%] top-[41.67%] h-[19.63%]"
                  src={images.footer.tamaraIcon}
                />
              </div>
              <div className="flex h-7 w-9 items-center justify-center rounded border border-border-primary bg-bg-primary">
                <img alt="Google Pay" className="h-[41.17%] w-[74.78%] object-contain" src={images.footer.googlePay} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-border-primary px-4 lg:px-16">
        <div className="flex flex-col gap-2 p-3 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          {/* <div /> */}
          {/* <img alt="Compliance badges" className="h-12 w-38 object-contain" src={images.footer.compliance} /> */}
          <div className="lg:w-full lg:text-left">
            <p className="text-sm font-medium tracking-[-0.28px] text-text-tertiary">
            H&CO • Nordbær • Gridvolt • Gründen
            </p>
            <p className="text-[10px] lg:text-base font-medium tracking-[-0.32px] text-text-secondary pb-4 lg:pb-0">
              © 2026 Hayes Distribution and Trade Network. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
