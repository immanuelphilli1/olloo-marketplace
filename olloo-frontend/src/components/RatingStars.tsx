import StarFillIcon from 'remixicon-react/StarFillIcon'

/**
 * Read-only star display. Interactive rating inputs keep their own buttons,
 * since only this needs to present an existing `rating` value.
 */
export function RatingStars({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' }) {
  const filled = Math.round(value)
  const iconClass = size === 'sm' ? 'size-4' : 'size-5'

  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <StarFillIcon
          key={index}
          className={`${iconClass} ${index < filled ? 'text-primary-gold' : 'text-bg-tertiary'}`}
          aria-hidden
        />
      ))}
    </div>
  )
}