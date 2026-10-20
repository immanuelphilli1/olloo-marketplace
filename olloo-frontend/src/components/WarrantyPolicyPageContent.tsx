import {
  warrantyPolicyBlocks,
  warrantyPolicyIntro,
  warrantyPolicyMeta,
} from '../data/warrantyPolicy'
import { useCmsPage } from '../hooks/useCmsPage'
import { LegalDocumentPageContent } from './LegalDocumentPageContent'

type WarrantyPolicyPageContentProps = {
  onGoHome: () => void
}

export function WarrantyPolicyPageContent({ onGoHome }: WarrantyPolicyPageContentProps) {
  const page = useCmsPage('warranty', {
    title: warrantyPolicyMeta.title,
    lastUpdated: warrantyPolicyMeta.lastUpdated,
    intro: warrantyPolicyIntro,
    blocks: warrantyPolicyBlocks,
  })

  return (
    <LegalDocumentPageContent
      breadcrumbLabel="Warranty"
      title={page.title}
      lastUpdated={page.lastUpdated}
      intro={page.intro}
      blocks={page.blocks}
      onGoHome={onGoHome}
    />
  )
}
