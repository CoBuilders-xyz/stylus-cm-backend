import { AlertType } from 'src/alerts/entities/alert.entity';

export interface NotificationData {
  alertId: string;
  alertType: AlertType;
  destination: string;
  userId: string;
}
