import { Injectable, Logger } from '@nestjs/common';
import { Alert } from 'src/alerts/entities/alert.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AlertType } from 'src/alerts/entities/alert.entity';
import { AlertsSettings } from 'src/users/entities/user.entity';

type NotificationData = {
  alertId: string;
  alertType: AlertType;
  destination: string;
  userId: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue('notif-slack')
    private slackQueue: Queue,
    @InjectQueue('notif-telegram')
    private telegramQueue: Queue,
    @InjectQueue('notif-email')
    private emailQueue: Queue,
    @InjectQueue('notif-webhook')
    private webhookQueue: Queue,
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

    const notificationData = {
      alertId: alert.id,
      alertType: alert.type,
      userId: alert.user.id,
    };

    const queuePromises: Promise<any>[] = [];

    // Check each notification channel
    if (alert.emailChannelEnabled && userSettings?.emailSettings?.enabled) {
      queuePromises.push(
        this.queueEmailNotification({
          ...notificationData,
          destination: userSettings.emailSettings.destination,
        }),
      );
    }

    if (alert.slackChannelEnabled && userSettings?.slackSettings?.enabled) {
      queuePromises.push(
        this.queueSlackNotification({
          ...notificationData,
          destination: userSettings.slackSettings.destination,
        }),
      );
    }

    if (
      alert.telegramChannelEnabled &&
      userSettings?.telegramSettings?.enabled
    ) {
      queuePromises.push(
        this.queueTelegramNotification({
          ...notificationData,
          destination: userSettings.telegramSettings.destination,
        }),
      );
    }

    if (alert.webhookChannelEnabled && userSettings?.webhookSettings?.enabled) {
      queuePromises.push(
        this.queueWebhookNotification({
          ...notificationData,
          destination: userSettings.webhookSettings.destination,
        }),
      );
    }

    // Wait for all notifications to be queued
    if (queuePromises.length > 0) {
      await Promise.all(queuePromises);
      this.logger.log(
        `Successfully queued ${queuePromises.length} notifications for alert: ${alert.id}`,
      );
    } else {
      this.logger.warn(
        `No notifications were queued for alert: ${alert.id} - check alert and user settings`,
      );
    }
  }

  async queueEmailNotification(data: NotificationData): Promise<void> {
    this.logger.log(
      `Queueing email notification to ${data.destination} for alert: ${data.alertId}`,
    );
    await this.emailQueue.add('send-email', data);
  }

  async queueSlackNotification(data: NotificationData): Promise<void> {
    this.logger.log(
      `Queueing Slack notification to ${data.destination} for alert: ${data.alertId}`,
    );
    await this.slackQueue.add('send-slack', data);
  }

  async queueTelegramNotification(data: NotificationData): Promise<void> {
    this.logger.log(
      `Queueing Telegram notification to ${data.destination} for alert: ${data.alertId}`,
    );
    await this.telegramQueue.add('send-telegram', data);
  }

  async queueWebhookNotification(data: NotificationData): Promise<void> {
    this.logger.log(
      `Queueing webhook notification to ${data.destination} for alert: ${data.alertId}`,
    );
    await this.webhookQueue.add('send-webhook', data);
  }
}
