export interface NotificationChannels {
  slack?: string;
  telegram?: string;
  webhook?: string;
}

export type NotificationChannelType = keyof NotificationChannels;

export const NOTIFICATION_CHANNEL_TYPES: NotificationChannelType[] = [
  'webhook',
  'slack',
  'telegram',
];
