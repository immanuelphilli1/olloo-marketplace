import {
  securePaymentsBlocks,
  securePaymentsIntro,
  securePaymentsMeta,
} from '../data/securePayments'
import { useCmsPage } from '../hooks/useCmsPage'
import { LegalDocumentPageContent } from './LegalDocumentPageContent'

type SecurePaymentsPageContentProps = {
  onGoHome: () => void
}

export function SecurePaymentsPageContent({ onGoHome }: SecurePaymentsPageContentProps) {
  const page = useCmsPage('secure-payments', {
    title: securePaymentsMeta.title,
    lastUpdated: securePaymentsMeta.lastUpdated,
    intro: securePaymentsIntro,
    blocks: securePaymentsBlocks,
  })

  return (
    <LegalDocumentPageContent
      breadcrumbLabel="Secure Payment"
      title={page.title}
      lastUpdated={page.lastUpdated}
      intro={page.intro}
      blocks={page.blocks}
      onGoHome={onGoHome}
    />
  )
}
