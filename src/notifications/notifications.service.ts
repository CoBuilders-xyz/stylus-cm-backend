import { Injectable } from '@nestjs/common';
import { Alert } from 'src/alerts/entities/alert.entity';
import { User } from 'src/users/entities/user.entity';
import { AlertsSettings } from 'src/users/interfaces/alerts-settings.interface';
import { NotificationQueueService } from './services/queue.service';
import { MockNotificationService } from './services/mock.service';
import { TimingService } from './services/timing.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationChannels } from './interfaces';
import { createModuleLogger } from 'src/common/utils/logger.util';

@Injectable()
export class NotificationsService {
  private readonly logger = createModuleLogger(
    NotificationsService,
    'Notifications',
  );

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
    this.logger.log(`Processing notifications for alert: ${alert.id}`);
    this.logger.debug(
      `Alert details: type=${alert.type}, userId=${alert.user.id}`,
    );

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
    this.logger.debug(
      `Enabled channels: ${JSON.stringify(Object.keys(channels))}`,
    );

    // Queue all enabled notifications
    const queuedCount = await this.queueService.queueNotifications(
      notificationData,
      channels,
    );

    if (queuedCount === 0) {
      this.logger.log(
        `No notifications queued for alert: ${alert.id} - no enabled channels`,
      );
      return;
    }

    this.logger.log(
      `Successfully queued ${queuedCount} notifications for alert: ${alert.id}`,
    );

    // Update lastNotified timestamp
    const updatedAlert = this.timingService.updateLastNotified(alert);
    await this.alertsRepository.save(updatedAlert);
  }

  async sendMockNotification(
    user: User,
    notificationChannel: 'webhook' | 'slack' | 'telegram',
  ) {
    this.logger.log(
      `Sending mock ${notificationChannel} notification for user: ${user.id}`,
    );
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
