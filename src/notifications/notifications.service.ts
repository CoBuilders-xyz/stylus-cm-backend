import { Injectable, Logger } from '@nestjs/common';
import { Alert } from 'src/alerts/entities/alert.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor() {}

  sendNotifications(alert: Alert) {
    this.logger.log(`Sending notifications for alert: ${alert.id}`);
  }
}
