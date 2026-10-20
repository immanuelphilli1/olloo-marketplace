import { images } from '../assets/images'

type AccountEmptyStateProps = {
  message: string
}

/**
 * Shared "nothing here yet" state for the account panels (orders, reviews,
 * addresses, payment methods, browsing history). Every panel that loads from the
 * API uses this rather than inventing its own copy, so an empty account reads the
 * same everywhere.
 */
export function AccountEmptyState({ message }: AccountEmptyStateProps) {
  return (
    <div
      role="status"
      className="flex min-h-121.25 w-full flex-col items-center justify-center gap-2 px-6 py-10"
    >
      <img alt="" aria-hidden className="size-33.5 shrink-0" src={images.orders.empty} />
      <p className="text-center text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
        {message}
      </p>
    </div>
  )
}
