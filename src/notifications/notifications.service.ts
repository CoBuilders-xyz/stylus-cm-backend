import { Injectable, Logger } from '@nestjs/common';
import { Alert } from 'src/alerts/entities/alert.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AlertType } from 'src/alerts/entities/alert.entity';
import { AlertsSettings, User } from 'src/users/entities/user.entity';
import { WebhookNotificationService } from './notif.webhook.service';
import { SlackNotificationService } from './notif.slack.service';
import { TelegramNotificationService } from './notif.telegram.service';
import { EmailNotificationService } from './notif.email.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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
    private webhookService: WebhookNotificationService,
    private slackService: SlackNotificationService,
    private telegramService: TelegramNotificationService,
    private emailService: EmailNotificationService,
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

    const notificationData = {
      alertId: alert.id,
      alertType: alert.type,
      userId: alert.user.id,
    };

    // Check if backoff_delay was not exceeded after lastNotified
    if (alert.lastNotified) {
      const backoffDelay = process.env.BACKOFF_DELAY;
      const lastNotified = new Date(alert.lastNotified);
      const now = new Date();
      const timeDiff = now.getTime() - lastNotified.getTime();
      if (timeDiff < Number(backoffDelay)) {
        this.logger.log(
          `Backoff delay not exceeded for alert: ${alert.id} - skipping notifications`,
        );
        return;
      }
    }

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

    // Update lastNotified
    alert.lastNotified = new Date();
    await this.alertsRepository.save(alert);
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

  async sendMockNotification(
    user: User,
    notificationChannel: 'webhook' | 'slack' | 'telegram' | 'email',
  ) {
    const mockData = {
      alertId: '123',
      alertValue: '100',
      alertContractAddress: '0x123',
      alertContractName: 'Mock Contract',
      alertType: AlertType.EVICTION,
      userId: user.id,
      destination: 'test@test.com',
      alertTypeDisplay: 'Mock Alert Type',
    };

    const destination =
      user.alertsSettings[`${notificationChannel}Settings`]?.destination;

    if (!destination) {
      this.logger.warn(`No destination found for ${notificationChannel}`);
      return;
    }

    this.logger.log(
      `Sending mock ${notificationChannel} notification to ${destination}`,
    );

    const sendServices = {
      webhook: this.webhookService,
      slack: this.slackService,
      telegram: this.telegramService,
      email: this.emailService,
      default: () => {},
    };

    await sendServices[notificationChannel].sendNotification({
      destination,
      recipientName: user.name,
      alertId: mockData.alertId,
      alertType: mockData.alertType,
      value: mockData.alertValue,
      contractName: mockData.alertContractName,
      contractAddress: mockData.alertContractAddress,
      triggeredCount: 0,
    });
    return {
      success: true,
      message: 'Mock notification sent',
    };
  }
}
