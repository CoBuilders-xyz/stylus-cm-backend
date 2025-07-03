import { Injectable } from '@nestjs/common';
import { AlertType } from 'src/alerts/entities/alert.entity';
import { User } from 'src/users/entities/user.entity';
import { WebhookNotificationService } from './webhook.service';
import { SlackNotificationService } from './slack.service';
import { TelegramNotificationService } from './telegram.service';
import { EmailNotificationService } from './email.service';
import { createModuleLogger } from 'src/common/utils/logger.util';

@Injectable()
export class MockNotificationService {
  private readonly logger = createModuleLogger(
    MockNotificationService,
    'Notifications',
  );

  constructor(
    private webhookService: WebhookNotificationService,
    private slackService: SlackNotificationService,
    private telegramService: TelegramNotificationService,
    private emailService: EmailNotificationService,
  ) {}

  async sendMockNotification(
    user: User,
    notificationChannel: 'webhook' | 'slack' | 'telegram' | 'email',
  ) {
    this.logger.log(
      `Preparing mock ${notificationChannel} notification for user: ${user.id}`,
    );

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
      this.logger.log(
        `No destination configured for ${notificationChannel} channel`,
      );
      return;
    }

    this.logger.debug(
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

    this.logger.log(
      `Successfully sent mock ${notificationChannel} notification to ${destination}`,
    );

    return {
      success: true,
      message: 'Mock notification sent',
    };
  }
}
