import { Link } from 'react-router-dom'
import BankCardLineIcon from 'remixicon-react/BankCardLineIcon'
import RefundLineIcon from 'remixicon-react/RefundLineIcon'
import SecurePaymentLineIcon from 'remixicon-react/SecurePaymentLineIcon'
import TruckLineIcon from 'remixicon-react/TruckLineIcon'

/**
 * Shopper reassurances. Each one links to the policy that backs it, and the copy
 * stays inside what those policies say: no delivery-day or return-window
 * numbers, which vary by market and seller.
 */
const features = [
  {
    title: 'Secure payments',
    subtitle: 'Encrypted checkout with trusted providers',
    icon: SecurePaymentLineIcon,
    to: '/secure-payments',
  },
  {
    title: 'Buyer protection',
    subtitle: "Refunds if an order doesn't arrive",
    icon: RefundLineIcon,
    to: '/return-refund',
  },
  {
    title: 'Tracked delivery',
    subtitle: 'Follow every order to your door',
    icon: TruckLineIcon,
    to: '/shipping-delivery',
  },
  {
    title: 'Pay your way',
    subtitle: 'Cards, wallets and pay later options',
    icon: BankCardLineIcon,
    to: '/secure-payments',
  },
]

export function FeaturesSection() {
  return (
    // Phones get one compact scrolling row so the strip doesn't push the
    // catalogue below the fold; desktop shows all four with their detail line.
    <section className="px-4 lg:px-16">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border-primary lg:overflow-visible lg:rounded-card lg:border lg:border-border-primary lg:px-0">
        {features.map((feature) => (
          <li key={feature.title} className="shrink-0">
            <Link
              to={feature.to}
              className="group flex h-full items-center gap-2 rounded-full bg-bg-secondary py-1.5 pl-1.5 pr-3.5 transition-colors hover:bg-brand-light lg:gap-3 lg:rounded-none lg:bg-transparent lg:px-6 lg:py-4"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand transition-colors group-hover:bg-brand group-hover:text-text-inverse lg:size-11">
                <feature.icon className="size-4.5 lg:size-5" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="whitespace-nowrap text-xs font-bold text-text-primary lg:text-sm">
                  {feature.title}
                </span>
                <span className="hidden text-xs leading-snug text-text-tertiary lg:block">
                  {feature.subtitle}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
