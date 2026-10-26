import type { ReactNode } from 'react'
import ArrowRightSLineIcon from 'remixicon-react/ArrowRightSLineIcon'

type SectionHeadingProps = {
  title: string
  subtitle?: string
  /** Leading glyph, e.g. a flame for deals. */
  icon?: ReactNode
  /** Text action on the right, such as "See all". */
  action?: { label: string; onClick: () => void }
  /** Extra controls on the right (carousel arrows); rendered after `action`. */
  children?: ReactNode
}

/**
 * Shared heading row for homepage sections, so every shelf reads with the same
 * rhythm: display-face title, optional one-line subtitle, actions on the right.
 */
export function SectionHeading({ title, subtitle, icon, action, children }: SectionHeadingProps) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon}
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold leading-tight tracking-[-0.02em] text-text-primary lg:text-[28px]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs font-medium text-text-tertiary lg:text-sm">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 lg:gap-3">
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            className="group flex cursor-pointer items-center gap-0.5 rounded-full py-1 pl-2 text-sm font-bold text-brand transition-colors hover:text-brand-dark"
          >
            {action.label}
            <ArrowRightSLineIcon
              className="size-4.5 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </button>
        ) : null}
        {children}
      </div>
    </div>
  )
}
