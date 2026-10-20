import { PageBreadcrumbs } from './PageBreadcrumbs'

export type LegalDocumentBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: readonly string[] }

type LegalDocumentPageContentProps = {
  breadcrumbLabel: string
  title: string
  lastUpdated: string
  intro: readonly string[]
  blocks: readonly LegalDocumentBlock[]
  onGoHome: () => void
}

function renderBlock(block: LegalDocumentBlock, index: number) {
  switch (block.type) {
    case 'heading':
      return (
        <p key={`${block.type}-${index}`} className="text-text-primary">
          {block.text}
        </p>
      )
    case 'paragraph':
      return <p key={`${block.type}-${index}`}>{block.text}</p>
    case 'bullets':
      return (
        <ul key={`${block.type}-${index}`} className="flex flex-col">
          {block.items.map((item) => (
            <li key={item} className="leading-4.5 lg:leading-5">
              * {item}
            </li>
          ))}
        </ul>
      )
    default: {
      const unhandled: never = block
      return unhandled
    }
  }
}

export function LegalDocumentPageContent({
  breadcrumbLabel,
  title,
  lastUpdated,
  intro,
  blocks,
  onGoHome,
}: LegalDocumentPageContentProps) {
  return (
    <main>
      <PageBreadcrumbs
        segments={[
          { label: 'Home', onClick: onGoHome },
          { label: breadcrumbLabel },
        ]}
      />

      <section className="border-b border-border-primary px-4 lg:px-16">
        <div className="flex flex-col gap-6 px-0 py-8 lg:px-6 lg:py-8">
          <div className="flex max-w-[688px] flex-col gap-8">
            <h1 className="text-xl font-medium tracking-[-0.4px] text-text-primary lg:text-2xl lg:leading-8">
              {title}
            </h1>
            <p className="text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-secondary">
              Last Updated: {lastUpdated}
            </p>
          </div>
        </div>

        <div className="px-0 py-8 lg:px-6 lg:py-10">
          <div className="flex flex-col gap-6 text-sm font-medium leading-4.5 tracking-[-0.28px] text-text-secondary lg:text-base lg:leading-5 lg:tracking-[-0.32px]">
            {intro.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {blocks.map((block, index) => renderBlock(block, index))}
          </div>
        </div>
      </section>
    </main>
  )
}
