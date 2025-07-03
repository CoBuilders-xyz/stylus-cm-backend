import { Injectable, Logger } from '@nestjs/common';
import { Alert } from 'src/alerts/entities/alert.entity';
import { AlertsSettings, User } from 'src/users/entities/user.entity';
import { NotificationQueueService } from './services/queue.service';
import { MockNotificationService } from './services/mock.service';
import { TimingService } from './services/timing.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

type NotificationChannels = {
  email?: string;
  slack?: string;
  telegram?: string;
  webhook?: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private queueService: NotificationQueueService,
    private mockService: MockNotificationService,
    private timingService: TimingService,
    @InjectRepository(Alert)
    private alertsRepository: Repository<Alert>,
  ) {}

  /**
   * Send notifications for an alert through all enabled channels
   * This method allows direct queueing of notifications outside the alerts processor
   */
  async sendNotifications(
    alert: Alert,
    userSettings: AlertsSettings,
  ): Promise<void> {
    this.logger.log(`Preparing notifications for alert: ${alert.id}`);

    // Check if backoff delay has been exceeded
    if (!this.timingService.isBackoffDelayExceeded(alert)) {
      return;
    }

    const notificationData = {
      alertId: alert.id,
      alertType: alert.type,
      userId: alert.user.id,
    };

    // Build channels object with enabled destinations
    const channels = this.buildEnabledChannels(alert, userSettings);

    // Queue all enabled notifications
    const queuedCount = await this.queueService.queueNotifications(
      notificationData,
      channels,
    );

    if (queuedCount === 0) {
      this.logger.warn(
        `No notifications were queued for alert: ${alert.id} - check alert and user settings`,
      );
      return;
    }

    // Update lastNotified timestamp
    const updatedAlert = this.timingService.updateLastNotified(alert);
    await this.alertsRepository.save(updatedAlert);
  }

  async sendMockNotification(
    user: User,
    notificationChannel: 'webhook' | 'slack' | 'telegram' | 'email',
  ) {
    return await this.mockService.sendMockNotification(
      user,
      notificationChannel,
    );
  }

  /**
   * Build enabled channels object based on alert and user settings
   */
  private buildEnabledChannels(
    alert: Alert,
    userSettings: AlertsSettings,
  ): NotificationChannels {
    const channels: NotificationChannels = {};

    if (alert.emailChannelEnabled && userSettings?.emailSettings?.enabled) {
      channels.email = userSettings.emailSettings.destination;
    }

    if (alert.slackChannelEnabled && userSettings?.slackSettings?.enabled) {
      channels.slack = userSettings.slackSettings.destination;
    }

    if (
      alert.telegramChannelEnabled &&
      userSettings?.telegramSettings?.enabled
    ) {
      channels.telegram = userSettings.telegramSettings.destination;
    }

    if (alert.webhookChannelEnabled && userSettings?.webhookSettings?.enabled) {
      channels.webhook = userSettings.webhookSettings.destination;
    }

    return channels;
  }
}
