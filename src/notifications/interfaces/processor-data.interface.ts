import { AlertType } from 'src/alerts/entities/alert.entity';

export interface BaseProcessorData {
  alertId: string;
  alertType: AlertType;
  destination: string;
  userId: string;
}

export type SlackNotificationData = BaseProcessorData;

export type EmailNotificationData = BaseProcessorData;

export type WebhookNotificationData = BaseProcessorData;

export type TelegramNotificationData = BaseProcessorData;
