import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationData, NotificationChannels } from '../interfaces';
import { BaseNotificationData } from '../interfaces/processor-data.interface';
import { createModuleLogger } from 'src/common/utils/logger.util';

@Injectable()
export class NotificationQueueService {
  private readonly logger = createModuleLogger(
    NotificationQueueService,
    'Notifications',
  );

  constructor(
    @InjectQueue('notif-slack')
    private slackQueue: Queue,
    @InjectQueue('notif-telegram')
    private telegramQueue: Queue,
    @InjectQueue('notif-webhook')
    private webhookQueue: Queue,
  ) {}

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
    baseData: BaseNotificationData,
    channels: NotificationChannels,
  ): Promise<number> {
    const queuePromises: Promise<void>[] = [];

    this.logger.debug(
      `Queueing notifications for alert: ${baseData.alertId}, enabled channels: ${Object.keys(channels).join(', ')}`,
    );

    // Queue each enabled channel

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
