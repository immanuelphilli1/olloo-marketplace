import {
  returnRefundPolicyBlocks,
  returnRefundPolicyIntro,
  returnRefundPolicyMeta,
} from '../data/returnRefundPolicy'
import { useCmsPage } from '../hooks/useCmsPage'
import { LegalDocumentPageContent } from './LegalDocumentPageContent'

type ReturnRefundPolicyPageContentProps = {
  onGoHome: () => void
}

export function ReturnRefundPolicyPageContent({ onGoHome }: ReturnRefundPolicyPageContentProps) {
  const page = useCmsPage('return-refund', {
    title: returnRefundPolicyMeta.title,
    lastUpdated: returnRefundPolicyMeta.lastUpdated,
    intro: returnRefundPolicyIntro,
    blocks: returnRefundPolicyBlocks,
  })

  return (
    <LegalDocumentPageContent
      breadcrumbLabel="Return & Refund Policy"
      title={page.title}
      lastUpdated={page.lastUpdated}
      intro={page.intro}
      blocks={page.blocks}
      onGoHome={onGoHome}
    />
  )
}
