/**
 * The olloo wordmark, drawn from geometry rather than a font so it renders
 * identically everywhere: each "o" is a ring and each "l" a rounded bar.
 *
 * It paints in `currentColor`, so callers colour it with a text utility
 * (`text-brand` on light surfaces, `text-text-inverse` on dark ones) instead of
 * swapping assets or filtering an image. The sun dot in the final "o" keeps the
 * accent colour in both cases.
 */
export function OllooLogo({
  className = 'h-7 w-auto text-brand',
  title = 'olloo',
}: {
  className?: string
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 94 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
    >
      <g fill="none" stroke="currentColor" strokeWidth="6">
        <circle cx="11" cy="19" r="8" />
        <circle cx="57" cy="19" r="8" />
        <circle cx="82" cy="19" r="8" />
      </g>
      <g fill="currentColor">
        <rect x="26" y="0" width="6" height="30" rx="3" />
        <rect x="36" y="0" width="6" height="30" rx="3" />
      </g>
      <circle cx="82" cy="19" r="3" fill="var(--color-accent)" />
    </svg>
  )
}

/**
 * Square app mark: two rings on the brand tile. Used where the full wordmark
 * would be too small to read, such as the footer badge and the favicon.
 */
export function OllooMark({ className = 'size-10' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="olloo"
    >
      <rect width="48" height="48" rx="14" fill="var(--color-brand)" />
      <g fill="none" stroke="#ffffff" strokeWidth="4.5">
        <circle cx="15.5" cy="24" r="7" />
        <circle cx="32.5" cy="24" r="7" />
      </g>
      <circle cx="32.5" cy="24" r="2.6" fill="var(--color-accent)" />
    </svg>
  )
}
