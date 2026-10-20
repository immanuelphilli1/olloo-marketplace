import { useEffect, useState } from 'react'
import { accountApi } from '../api'
import { mapApiNotificationSettings } from '../api/mappers'
import ShieldCheckFillIcon from 'remixicon-react/ShieldCheckFillIcon'
import {
  notificationScamWarning,
  notificationSettingLabel,
  type NotificationSetting,
  type NotificationSettingId,
} from '../data/notifications'
import { ListingLoader } from './ListingLoader'

function NotificationToggle({
  enabled,
  onChange,
  label,
}: {
  enabled: boolean
  onChange: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={onChange}
      className={`relative h-8 w-12 shrink-0 cursor-pointer rounded-full transition-colors ${
        enabled ? 'bg-text-primary' : 'bg-border-secondary'
      }`}
    >
      <span
        className={`absolute top-1 size-6 rounded-full bg-bg-primary transition-transform ${
          enabled ? 'left-5' : 'left-1'
        }`}
        aria-hidden
      />
    </button>
  )
}

function NotificationRow({
  setting,
  onToggle,
}: {
  setting: NotificationSetting
  onToggle: () => void
}) {
  const label = notificationSettingLabel(setting.title, setting.enabled)

  return (
    <div className="flex items-center gap-4 border-b border-border-primary py-4">
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium leading-5 tracking-[-0.32px] text-text-primary">
          {label}
        </p>
        <p className="mt-2 text-sm leading-4.5 tracking-[-0.28px] text-text-primary">
          {setting.description}
        </p>
      </div>
      <NotificationToggle enabled={setting.enabled} onChange={onToggle} label={label} />
    </div>
  )
}

export function NotificationsPanel() {
  const [settings, setSettings] = useState<NotificationSetting[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadSettings() {
      setIsLoading(true)
      try {
        const response = await accountApi.getNotificationSettings()
        const items = mapApiNotificationSettings(response)
        if (!cancelled) {
          setSettings(items)
        }
      } catch {
        if (!cancelled) {
          setSettings([])
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadSettings()

    return () => {
      cancelled = true
    }
  }, [])

  const toggleSetting = (settingId: NotificationSettingId) => {
    setSettings((current) => {
      const next = current.map((setting) =>
        setting.id === settingId ? { ...setting, enabled: !setting.enabled } : setting,
      )
      const updated = next.find((setting) => setting.id === settingId)
      if (updated) {
        void accountApi.updateNotificationSetting(settingId, updated.enabled).catch(() => undefined)
      }
      return next
    })
  }

  return (
    <div className="flex flex-col">
      <div className="px-0 py-4 lg:px-2 lg:py-4">
        <div className="flex items-center gap-4 rounded-2xl bg-green-light p-3">
          <ShieldCheckFillIcon className="size-6 shrink-0 text-primary-green" aria-hidden />
          <p className="text-base font-medium leading-5 tracking-[-0.32px] text-primary-green">
            {notificationScamWarning}
          </p>
        </div>
      </div>

      <div className="px-0 py-4 lg:px-2 lg:py-4">
        {isLoading ? (
          <ListingLoader label="Loading notification settings" />
        ) : settings.length === 0 ? (
          <p className="py-6 text-center text-sm leading-4.5 tracking-[-0.28px] text-text-secondary">
            Notification settings are unavailable right now. Please try again later.
          </p>
        ) : (
          settings.map((setting) => (
            <NotificationRow
              key={setting.id}
              setting={setting}
              onToggle={() => toggleSetting(setting.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
