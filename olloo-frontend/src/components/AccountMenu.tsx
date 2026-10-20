import { useEffect } from 'react'
import ChatHeartLineIcon from 'remixicon-react/ChatHeartLineIcon'
import FileList3LineIcon from 'remixicon-react/FileList3LineIcon'
import HistoryLineIcon from 'remixicon-react/HistoryLineIcon'
import LogoutBoxRLineIcon from 'remixicon-react/LogoutBoxRLineIcon'
import Notification3LineIcon from 'remixicon-react/Notification3LineIcon'
import UserLineIcon from 'remixicon-react/UserLineIcon'
import UserLocationLineIcon from 'remixicon-react/UserLocationLineIcon'
import Wallet3LineIcon from 'remixicon-react/Wallet3LineIcon'

type AccountMenuProps = {
  isOpen: boolean
  userFullName: string
  onClose: () => void
  onSignOut?: () => void
  onYourOrdersClick?: () => void
  onYourReviewsClick?: () => void
  onYourProfileClick?: () => void
  onBrowsingHistoryClick?: () => void
  onAddressesClick?: () => void
  onPaymentMethodsClick?: () => void
  onNotificationsClick?: () => void
}

type RemixIcon = typeof UserLineIcon

type AccountMenuItem = {
  label: string
  icon: RemixIcon
}

const accountMenuItems: AccountMenuItem[] = [
  { label: 'Your orders', icon: FileList3LineIcon },
  { label: 'Your reviews', icon: ChatHeartLineIcon },
  { label: 'Your profile', icon: UserLineIcon },
  { label: 'Browsing history', icon: HistoryLineIcon },
  { label: 'Addresses', icon: UserLocationLineIcon },
  { label: 'Saved cards', icon: Wallet3LineIcon },
  { label: 'Notifications', icon: Notification3LineIcon },
]

const menuItemButton =
  'group flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-orange-light active:bg-bg-secondary'

function AccountMenuItemButton({
  item,
  onClick,
}: {
  item: AccountMenuItem
  onClick?: () => void
}) {
  const Icon = item.icon

  return (
    <button type="button" onClick={onClick} className={menuItemButton}>
      <Icon
        className="size-6 shrink-0 text-text-secondary transition-colors group-hover:text-primary-orange"
        aria-hidden
      />
      <span className="flex-1 text-sm font-medium leading-4 tracking-[-0.28px] text-text-primary transition-colors group-hover:text-primary-orange">
        {item.label}
      </span>
    </button>
  )
}

export function AccountMenu({
  isOpen,
  userFullName,
  onClose,
  onSignOut,
  onYourOrdersClick,
  onYourReviewsClick,
  onYourProfileClick,
  onBrowsingHistoryClick,
  onAddressesClick,
  onPaymentMethodsClick,
  onNotificationsClick,
}: AccountMenuProps) {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const userInitial = userFullName.charAt(0).toUpperCase()

  return (
    <div
      role="menu"
      aria-label="Account menu"
      className="fixed right-4 top-[calc(var(--nav-height,8rem)+8px)] z-50 flex w-[min(313px,calc(100vw-2rem))] flex-col gap-2 rounded-2xl bg-bg-primary p-4 shadow-[0px_1px_4px_0px_rgba(0,0,0,0.04),0px_4px_40px_0px_rgba(0,0,0,0.08)] lg:absolute lg:right-0 lg:top-[calc(100%+8px)] lg:w-78"
    >
      <div className="flex items-center gap-4 rounded-lg bg-bg-secondary p-2">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bg-primary text-2xl font-medium leading-8 tracking-[-0.48px] text-text-primary">
          {userInitial}
        </div>
        <p className="text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
          {userFullName}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {accountMenuItems.map((item) => (
          <AccountMenuItemButton
            key={item.label}
            item={item}
            onClick={
              item.label === 'Your orders'
                ? () => {
                    onClose()
                    onYourOrdersClick?.()
                  }
                : item.label === 'Your reviews'
                  ? () => {
                      onClose()
                      onYourReviewsClick?.()
                    }
                  : item.label === 'Your profile'
                    ? () => {
                        onClose()
                        onYourProfileClick?.()
                      }
                    : item.label === 'Browsing history'
                      ? () => {
                          onClose()
                          onBrowsingHistoryClick?.()
                        }
                      : item.label === 'Addresses'
                        ? () => {
                            onClose()
                            onAddressesClick?.()
                          }
                        : item.label === 'Saved cards'
                          ? () => {
                              onClose()
                              onPaymentMethodsClick?.()
                            }
                          : item.label === 'Notifications'
                            ? () => {
                                onClose()
                                onNotificationsClick?.()
                              }
                            : undefined
            }
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          onClose()
          onSignOut?.()
        }}
        className={menuItemButton}
      >
        <LogoutBoxRLineIcon
          className="size-6 shrink-0 text-text-secondary transition-colors group-hover:text-primary-orange"
          aria-hidden
        />
        <span className="flex-1 text-sm font-medium leading-4 tracking-[-0.28px] text-text-primary transition-colors group-hover:text-primary-orange">
          Sign Out
        </span>
      </button>
    </div>
  )
}
