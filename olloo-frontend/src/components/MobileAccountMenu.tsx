import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import ArrowRightSLineIcon from 'remixicon-react/ArrowRightSLineIcon'
import CloseLineIcon from 'remixicon-react/CloseLineIcon'
import type { AccountSection } from '../data/accountRoutes'

type MobileAccountMenuProps = {
  isOpen: boolean
  /** Full name shown in the header of the sheet. */
  userFullName: string
  /** Email shown under the name, for confirmation of which account is active. */
  userEmail: string
  activeSection: AccountSection
  onClose: () => void
  onSectionSelect: (section: AccountSection) => void
  onSignOut?: () => void
}

type MenuItem = {
  id: AccountSection
  label: string
}

/**
 * Mobile counterpart to the desktop `AccountMenu`. The bottom nav's Account tab
 * opens this sheet instead of navigating straight to orders, so all account
 * sections are reachable from one place on small screens — mirroring how the
 * Categories tab opens the categories panel.
 */
const menuItems: MenuItem[] = [
  { id: 'orders', label: 'Your orders' },
  { id: 'reviews', label: 'Your reviews' },
  { id: 'profile', label: 'Your profile' },
  { id: 'history', label: 'Browsing history' },
  { id: 'addresses', label: 'Addresses' },
  { id: 'payments', label: 'Saved cards' },
  { id: 'notifications', label: 'Notifications' },
]

export function MobileAccountMenu({
  isOpen,
  userFullName,
  userEmail,
  activeSection,
  onClose,
  onSectionSelect,
  onSignOut,
}: MobileAccountMenuProps) {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)

    // Prevents the page behind the sheet from scrolling while it is open.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Portalled to <body> so the fixed header's `overflow-x-clip` cannot crop the
  // sheet, and so it stacks above the bottom app nav rather than behind it.
  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close account menu"
        className="fixed inset-0 z-60 cursor-pointer bg-[rgba(0,6,7,0.7)] lg:hidden"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Account menu"
        className="fixed inset-x-0 bottom-0 z-60 flex max-h-[80dvh] flex-col overflow-hidden rounded-t-2xl bg-bg-primary pb-24 shadow-[0px_-4px_40px_0px_rgba(0,0,0,0.12)] lg:hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border-primary p-4">
          <p className="min-w-0 flex-1 text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
            Account
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close account menu"
            className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-bg-secondary"
          >
            <CloseLineIcon className="size-5 text-text-secondary" aria-hidden />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
          <div className="mb-2 flex items-center gap-4 rounded-lg bg-bg-secondary p-2">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bg-primary text-2xl font-medium leading-8 tracking-[-0.48px] text-text-primary">
              {userFullName.charAt(0).toUpperCase()}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="truncate text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
                {userFullName}
              </p>
              {userEmail ? (
                <p className="truncate text-sm leading-4 tracking-[-0.28px] text-text-secondary">
                  {userEmail}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {menuItems.map((item) => {
              const isActive = item.id === activeSection

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onClose()
                    onSectionSelect(item.id)
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-lg p-3 text-left transition-colors active:bg-bg-secondary ${
                    isActive ? 'bg-orange-light' : 'hover:bg-orange-light'
                  }`}
                >
                  <span
                    className={`flex-1 text-base font-medium tracking-[-0.32px] ${
                      isActive ? 'text-primary-orange' : 'text-text-primary'
                    }`}
                  >
                    {item.label}
                  </span>
                  <ArrowRightSLineIcon className="size-6 shrink-0 text-text-secondary" aria-hidden />
                </button>
              )
            })}
          </div>

          {onSignOut ? (
            <button
              type="button"
              onClick={() => {
                onClose()
                onSignOut()
              }}
              className="mt-2 w-full cursor-pointer rounded-lg p-3 text-left text-base font-medium tracking-[-0.32px] text-text-primary transition-colors hover:bg-orange-light active:bg-bg-secondary"
            >
              Sign Out
            </button>
          ) : null}
        </div>
      </div>
    </>,
    document.body,
  )
}