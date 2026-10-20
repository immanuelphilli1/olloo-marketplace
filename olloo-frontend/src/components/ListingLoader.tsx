import LoaderLineIcon from 'remixicon-react/LoaderLineIcon'

type ListingLoaderProps = {
  /** Describes what is loading, for screen readers. */
  label?: string
}

/**
 * Spinner shown while a grid or list is fetching. Shared by the category listing,
 * the search results page, and the account orders page so each waits on the same
 * indicator.
 */
export function ListingLoader({ label = 'Loading products' }: ListingLoaderProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex min-h-48 items-center justify-center py-10"
    >
      <LoaderLineIcon className="size-8 animate-spin text-primary-orange" aria-hidden />
    </div>
  )
}
