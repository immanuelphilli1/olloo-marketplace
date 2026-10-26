import HeartFillIcon from 'remixicon-react/HeartFillIcon'
import HeartLineIcon from 'remixicon-react/HeartLineIcon'
import Home5FillIcon from 'remixicon-react/Home5FillIcon'
import Home5LineIcon from 'remixicon-react/Home5LineIcon'
import LayoutGridFillIcon from 'remixicon-react/LayoutGridFillIcon'
import LayoutGridLineIcon from 'remixicon-react/LayoutGridLineIcon'
import ShoppingCart2FillIcon from 'remixicon-react/ShoppingCart2FillIcon'
import ShoppingCart2LineIcon from 'remixicon-react/ShoppingCart2LineIcon'
import User3FillIcon from 'remixicon-react/User3FillIcon'
import User3LineIcon from 'remixicon-react/User3LineIcon'

export type MobileNavTab = 'home' | 'categories' | 'favourite' | 'cart' | 'account'

type MobileAppNavigationProps = {
  activeTab: MobileNavTab
  onHome: () => void
  onCategories: () => void
  onFavourite: () => void
  onCart: () => void
  onAccount: () => void
  /** Total quantity in the cart, shown as a badge on the Cart tab. */
  cartItemCount?: number
  /**
   * Label for the Account tab. Signed-in users see their first name instead of
   * the generic "Account", which is undefined while signed out.
   */
  accountLabel?: string
}

type TabConfig = {
  id: MobileNavTab
  label: string
  icon: typeof Home5LineIcon
  activeIcon: typeof Home5FillIcon
}

const tabs: TabConfig[] = [
  { id: 'home', label: 'Home', icon: Home5LineIcon, activeIcon: Home5FillIcon },
  { id: 'categories', label: 'Categories', icon: LayoutGridLineIcon, activeIcon: LayoutGridFillIcon },
  { id: 'favourite', label: 'Wishlist', icon: HeartLineIcon, activeIcon: HeartFillIcon },
  { id: 'cart', label: 'Cart', icon: ShoppingCart2LineIcon, activeIcon: ShoppingCart2FillIcon },
  { id: 'account', label: 'Account', icon: User3LineIcon, activeIcon: User3FillIcon },
]

export function MobileAppNavigation({
  activeTab,
  onHome,
  onCategories,
  onFavourite,
  onCart,
  onAccount,
  cartItemCount = 0,
  accountLabel,
}: MobileAppNavigationProps) {
  const handlers: Record<MobileNavTab, () => void> = {
    home: onHome,
    categories: onCategories,
    favourite: onFavourite,
    cart: onCart,
    account: onAccount,
  }

  return (
    <nav
      aria-label="App navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border-primary bg-bg-primary/95 px-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex max-w-360 items-center justify-between">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const TabIcon = isActive ? tab.activeIcon : tab.icon

          return (
            <button
              key={tab.id}
              type="button"
              onClick={handlers[tab.id]}
              className="flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1"
              aria-current={isActive ? 'page' : undefined}
            >
              {/* The Cart tab carries the item-count badge the desktop header shows. */}
              <span
                className={`relative flex h-8 w-12 items-center justify-center rounded-full transition-colors ${
                  isActive ? 'bg-brand-light' : ''
                }`}
              >
                <TabIcon
                  className={`size-5.5 shrink-0 ${isActive ? 'text-brand' : 'text-text-tertiary'}`}
                  aria-hidden
                />
                {tab.id === 'cart' && cartItemCount > 0 ? (
                  <span className="absolute right-0.5 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full border-2 border-bg-primary bg-accent px-1 text-[10px] font-extrabold leading-none text-accent-ink">
                    {cartItemCount}
                  </span>
                ) : null}
              </span>
              <span
                className={`w-full truncate text-center text-[11px] leading-none ${
                  isActive ? 'font-bold text-brand' : 'font-medium text-text-tertiary'
                }`}
              >
                {/* A signed-in user's first name replaces the generic label. */}
                {tab.id === 'account' && accountLabel ? accountLabel : tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
