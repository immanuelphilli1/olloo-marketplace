import ArrowLeftSLineIcon from 'remixicon-react/ArrowLeftSLineIcon'
import ArrowRightSLineIcon from 'remixicon-react/ArrowRightSLineIcon'

export type BreadcrumbSegment = {
  label: string
  onClick?: () => void
}

type PageBreadcrumbsProps = {
  segments: BreadcrumbSegment[]
  onGoBack?: () => void
}

export function PageBreadcrumbs({ segments, onGoBack }: PageBreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 px-4 py-2 lg:gap-1 lg:px-16">
      {onGoBack ? (
        <button
          type="button"
          onClick={onGoBack}
          aria-label="Go back"
          className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-bg-secondary lg:hidden"
        >
          <ArrowLeftSLineIcon className="size-5 text-text-secondary" aria-hidden />
        </button>
      ) : null}

      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1

        return (
          <span key={`${segment.label}-${index}`} className="flex min-w-0 items-center gap-2 lg:gap-1">
            {index > 0 ? (
              <ArrowRightSLineIcon className="size-6 shrink-0 text-text-tertiary" aria-hidden />
            ) : null}
            {segment.onClick && !isLast ? (
              <button
                type="button"
                onClick={segment.onClick}
                className="cursor-pointer py-2.5 text-sm font-medium leading-4 tracking-[-0.28px] text-text-tertiary transition-colors hover:text-text-primary"
              >
                {segment.label}
              </button>
            ) : (
              <span
                className={`py-2.5 text-sm font-medium leading-4 tracking-[-0.28px] ${
                  isLast ? 'text-text-primary' : 'text-text-tertiary'
                }`}
              >
                {segment.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
