import {
  shippingDeliveryPolicyBlocks,
  shippingDeliveryPolicyIntro,
  shippingDeliveryPolicyMeta,
} from '../data/shippingDeliveryPolicy'
import { useCmsPage } from '../hooks/useCmsPage'
import { LegalDocumentPageContent } from './LegalDocumentPageContent'

type ShippingDeliveryPolicyPageContentProps = {
  onGoHome: () => void
}

export function ShippingDeliveryPolicyPageContent({
  onGoHome,
}: ShippingDeliveryPolicyPageContentProps) {
  const page = useCmsPage('shipping-delivery', {
    title: shippingDeliveryPolicyMeta.title,
    lastUpdated: shippingDeliveryPolicyMeta.lastUpdated,
    intro: shippingDeliveryPolicyIntro,
    blocks: shippingDeliveryPolicyBlocks,
  })

  return (
    <LegalDocumentPageContent
      breadcrumbLabel="Shipping & Delivery"
      title={page.title}
      lastUpdated={page.lastUpdated}
      intro={page.intro}
      blocks={page.blocks}
      onGoHome={onGoHome}
    />
  )
}
