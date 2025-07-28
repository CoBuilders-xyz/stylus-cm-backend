import { AlertType } from 'src/alerts/entities/alert.entity';

export interface BaseProcessorData {
  alertId: string;
  alertType: AlertType;
  destination: string;
  userId: string;
}
