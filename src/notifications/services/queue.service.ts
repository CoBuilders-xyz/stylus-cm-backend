import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AlertType } from 'src/alerts/entities/alert.entity';

export type NotificationData = {
  alertId: string;
  alertType: AlertType;
  destination: string;
  userId: string;
};

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);

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

  /**
   * Queue notifications for all enabled channels
   * Returns the number of notifications queued
   */
  async queueNotifications(
    baseData: { alertId: string; alertType: AlertType; userId: string },
    channels: {
      email?: string;
      slack?: string;
      telegram?: string;
      webhook?: string;
    },
  ): Promise<number> {
    const queuePromises: Promise<void>[] = [];

    // Queue each enabled channel
    if (channels.email) {
      queuePromises.push(
        this.queueEmailNotification({
          ...baseData,
          destination: channels.email,
        }),
      );
    }

    if (channels.slack) {
      queuePromises.push(
        this.queueSlackNotification({
          ...baseData,
          destination: channels.slack,
        }),
      );
    }

    if (channels.telegram) {
      queuePromises.push(
        this.queueTelegramNotification({
          ...baseData,
          destination: channels.telegram,
        }),
      );
    }

    if (channels.webhook) {
      queuePromises.push(
        this.queueWebhookNotification({
          ...baseData,
          destination: channels.webhook,
        }),
      );
    }

    // Wait for all notifications to be queued
    if (queuePromises.length > 0) {
      await Promise.all(queuePromises);
      this.logger.log(
        `Successfully queued ${queuePromises.length} notifications for alert: ${baseData.alertId}`,
      );
    }

    return queuePromises.length;
  }
}
