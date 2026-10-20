import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import CloseFillIcon from 'remixicon-react/CloseFillIcon'
import type { AddressResidenceMismatch } from '../utils/addressResidenceMatch'

type CountryResidenceMismatchModalProps = {
  isOpen: boolean
  mismatch: AddressResidenceMismatch | null
  onClose: () => void
  onAddAddressForResidence: () => void
  onProceedAnyway: () => void
}

const titleId = 'country-residence-mismatch-title'

export function CountryResidenceMismatchModal({
  isOpen,
  mismatch,
  onClose,
  onAddAddressForResidence,
  onProceedAnyway,
}: CountryResidenceMismatchModalProps) {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, onClose])

  if (!isOpen || !mismatch) return null

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
        className="fixed left-1/2 top-1/2 z-50 flex w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-bg-primary"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border-primary px-6 py-4">
          <h2
            id={titleId}
            className="min-w-0 flex-1 text-base font-semibold leading-5 tracking-[-0.32px] text-text-secondary"
          >
            Country mismatch
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
            Your default address and country of residence must match before payment
          </p>
          <p className="text-sm leading-4.5 tracking-[-0.28px] text-text-secondary">
            Default address: <span className="font-medium text-text-primary">{mismatch.addressCountryLabel}</span>
            . Country of residence:{' '}
            <span className="font-medium text-text-primary">{mismatch.residenceCountryLabel}</span>.
            Choose how you would like to fix this.
          </p>

          <div className="mt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={onAddAddressForResidence}
              className="btn-orange flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full px-4 py-3 text-base font-medium leading-5 tracking-[-0.32px] text-text-inverse"
            >
              Add a default address in {mismatch.residenceCountryLabel}
            </button>
            <button
              type="button"
              onClick={onProceedAnyway}
              className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full border border-border-primary bg-bg-secondary px-4 py-3 text-base font-medium leading-5 tracking-[-0.32px] text-text-primary"
            >
              Proceed anyways
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
