import { images } from '../assets/images'
import { Icon } from './Icon'

const features = [
  {
    title: 'Fast delivery',
    subtitle: '2-day Shipping available',
    icon: images.features.delivery,
  },
  {
    title: 'Secure Payments',
    subtitle: '100% Secure Checkout',
    icon: images.features.quality,
  },
  {
    title: '24/7 Support',
    subtitle: 'Dedicated trade desk',
    icon: images.features.support,
  },
  {
    title: 'Easy Returns',
    subtitle: '30 days return policy',
    icon: images.features.support,
  },
]

export function FeaturesSection() {
  return (
    <section className="hidden px-4 lg:block lg:px-16">
      <div className="py-2">
        <div className="overflow-hidden rounded-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className={`flex items-center gap-4 bg-bg-secondary px-6 py-6 lg:gap-4.25 lg:px-8 lg:py-4 ${
                  index < features.length - 1 ? 'lg:border-r lg:border-border-primary' : ''
                }`}
              >
                <Icon src={feature.icon} className="size-8 shrink-0 brightness-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-lg font-semibold tracking-[-0.4px] text-text-secondary">
                    {feature.title}
                  </p>
                  <p className="text-sm font-medium tracking-[-0.32px] text-text-secondary">
                    {feature.subtitle}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
