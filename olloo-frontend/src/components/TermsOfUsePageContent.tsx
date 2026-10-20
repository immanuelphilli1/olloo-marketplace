import { termsOfUseBlocks, termsOfUseIntro, termsOfUseMeta } from '../data/termsOfUse'
import { useCmsPage } from '../hooks/useCmsPage'
import { LegalDocumentPageContent } from './LegalDocumentPageContent'

type TermsOfUsePageContentProps = {
  onGoHome: () => void
}

export function TermsOfUsePageContent({ onGoHome }: TermsOfUsePageContentProps) {
  const page = useCmsPage('terms-of-use', {
    title: termsOfUseMeta.title,
    lastUpdated: termsOfUseMeta.lastUpdated,
    intro: termsOfUseIntro,
    blocks: termsOfUseBlocks,
  })

  return (
    <LegalDocumentPageContent
      breadcrumbLabel="Terms of Use"
      title={page.title}
      lastUpdated={page.lastUpdated}
      intro={page.intro}
      blocks={page.blocks}
      onGoHome={onGoHome}
    />
  )
}