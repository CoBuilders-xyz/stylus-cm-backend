/**
 * Interface for Telegram notification settings
 */
export interface TelegramSettings {
  enabled: boolean;
  destination: string;
}

/**
 * Interface for Slack notification settings
 */
export interface SlackSettings {
  enabled: boolean;
  destination: string;
}

/**
 * Interface for webhook notification settings
 */
export interface WebhookSettings {
  enabled: boolean;
  destination: string;
}

/**
 * Main alerts settings interface containing all notification channels
 */
export interface AlertsSettings {
  telegramSettings?: TelegramSettings;
  slackSettings?: SlackSettings;
  webhookSettings?: WebhookSettings;
}

/**
 * Type for notification channel settings
 */
export type NotificationChannelSettings =
  | TelegramSettings
  | SlackSettings
  | WebhookSettings;

/**
 * Type for alert channel keys
 */
export type AlertChannelKey = keyof AlertsSettings;
