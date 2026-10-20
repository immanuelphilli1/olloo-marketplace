export type NotificationSettingId = 'promotions' | 'orderUpdates'

export type NotificationSetting = {
  id: NotificationSettingId
  title: string
  description: string
  enabled: boolean
}

export const notificationScamWarning =
  'H&CO. does not ask customers for additional fees via SMS or emial.'

export const defaultNotificationSettings: NotificationSetting[] = [
  {
    id: 'promotions',
    title: 'Promotions',
    description:
      'Be the first to learn about promotions, daily deals, and other exclusive savings.',
    enabled: true,
  },
  {
    id: 'orderUpdates',
    title: 'Order updates',
    description: 'Receive notifications about order confirmations and shipment updates.',
    enabled: true,
  },
]

export function notificationSettingLabel(title: string, enabled: boolean): string {
  return `${title} : ${enabled ? 'On' : 'Off'} Email`
}
