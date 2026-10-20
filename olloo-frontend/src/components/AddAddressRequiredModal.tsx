import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import CloseFillIcon from 'remixicon-react/CloseFillIcon'

type AddAddressRequiredModalProps = {
  isOpen: boolean
  onClose: () => void
  /** Opens the addresses page so the shopper can add or set a default address. */
  onContinue: () => void
}

const titleId = 'add-address-required-title'

/**
 * Shown when checkout cannot proceed because the account has no default delivery
 * address. Payment cannot start without an address the order can be shipped to,
 * so this replaces an inline error with a modal whose only action is the fix:
 * going to the addresses page.
 */
export function AddAddressRequiredModal({
  isOpen,
  onClose,
  onContinue,
}: AddAddressRequiredModalProps) {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)

    // Stops the checkout page scrolling behind the modal.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-50 cursor-pointer bg-[rgba(0,6,7,0.3)]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed left-1/2 top-1/2 z-50 flex w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-bg-primary"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border-primary px-6 py-4">
          <h2
            id={titleId}
            className="min-w-0 flex-1 text-base font-semibold leading-5 tracking-[-0.32px] text-text-secondary"
          >
            Delivery address needed
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center"
          >
            <CloseFillIcon className="size-6 text-text-secondary" aria-hidden />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6 py-6">
          <p className="text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
            Add a delivery address before paying
          </p>
          <p className="text-sm leading-4.5 tracking-[-0.28px] text-text-secondary">
            We need an address to deliver your order to. Add one and set it as your default, then
            come back and submit your order.
          </p>

          <div className="mt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={onContinue}
              className="btn-orange flex h-11 w-full cursor-pointer items-center justify-center rounded-full px-4 text-base font-medium leading-5 tracking-[-0.32px] text-text-inverse"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full cursor-pointer rounded-full px-4 py-2 text-base font-medium leading-5 tracking-[-0.32px] text-text-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}