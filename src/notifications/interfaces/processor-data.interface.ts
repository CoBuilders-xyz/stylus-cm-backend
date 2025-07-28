import { AlertType } from 'src/alerts/entities/alert.entity';

export interface BaseNotificationData {
  alertId: string;
  alertType: AlertType;
  userId: string;
}

export interface BaseProcessorData {
  alertId: string;
  alertType: AlertType;
  destination: string;
  userId: string;
}
