import {
  intellectualPropertyBlocks,
  intellectualPropertyIntro,
  intellectualPropertyMeta,
} from '../data/intellectualProperty'
import { useCmsPage } from '../hooks/useCmsPage'
import { LegalDocumentPageContent } from './LegalDocumentPageContent'

type IntellectualPropertyPageContentProps = {
  onGoHome: () => void
}

export function IntellectualPropertyPageContent({ onGoHome }: IntellectualPropertyPageContentProps) {
  const page = useCmsPage('intellectual-property', {
    title: intellectualPropertyMeta.title,
    lastUpdated: intellectualPropertyMeta.lastUpdated,
    intro: intellectualPropertyIntro,
    blocks: intellectualPropertyBlocks,
  })

  return (
    <LegalDocumentPageContent
      breadcrumbLabel="Intellectual Property"
      title={page.title}
      lastUpdated={page.lastUpdated}
      intro={page.intro}
      blocks={page.blocks}
      onGoHome={onGoHome}
    />
  )
}
