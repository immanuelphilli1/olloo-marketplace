import {
  privacyPolicyBlocks,
  privacyPolicyIntro,
  privacyPolicyMeta,
} from '../data/privacyPolicy'
import { useCmsPage } from '../hooks/useCmsPage'
import { LegalDocumentPageContent } from './LegalDocumentPageContent'

type PrivacyPolicyPageContentProps = {
  onGoHome: () => void
}

export function PrivacyPolicyPageContent({ onGoHome }: PrivacyPolicyPageContentProps) {
  const page = useCmsPage('privacy-policy', {
    title: privacyPolicyMeta.title,
    lastUpdated: privacyPolicyMeta.lastUpdated,
    intro: privacyPolicyIntro,
    blocks: privacyPolicyBlocks,
  })

  return (
    <LegalDocumentPageContent
      breadcrumbLabel="Privacy Policy"
      title={page.title}
      lastUpdated={page.lastUpdated}
      intro={page.intro}
      blocks={page.blocks}
      onGoHome={onGoHome}
    />
  )
}
