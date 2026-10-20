type CarouselDotsProps = {
  count: number
  activeIndex: number
  onSelect?: (index: number) => void
  className?: string
  /** Fades the dots on mobile only; desktop indicators stay fully opaque. */
  muted?: boolean
}

// Padding is reduced on mobile: the default `px-8 py-2` was sized for the wide
// desktop carousels and left the dot row floating in empty space on a phone.
// `className` still wins, since it is appended after these utilities.
const dotsWrapperClass = 'flex items-center justify-center gap-2 px-2 py-1 lg:px-8 lg:py-2'

export function CarouselDots({
  count,
  activeIndex,
  onSelect,
  className = '',
  muted = false,
}: CarouselDotsProps) {
  return (
    <div className={`${dotsWrapperClass} ${className}`}>
      {Array.from({ length: count }, (_, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onSelect?.(index)}
          aria-label={`Go to slide ${index + 1}`}
          // `muted` drops the dots well below full opacity so a carousel can sit
          // behind a transparent header without the indicators competing with it.
          className={`rounded-full transition-[width,background-color] duration-300 ${
            index === activeIndex
              ? 'h-2 w-8 bg-primary-orange'
              : 'size-2 bg-bg-tertiary hover:bg-border-secondary'
          } ${muted ? 'opacity-30 lg:opacity-100' : ''}`}
        />
      ))}
    </div>
  )
}
