import { Injectable } from '@nestjs/common';
import { AlertType } from 'src/alerts/entities/alert.entity';
import { User } from 'src/users/entities/user.entity';
import { WebhookNotificationService } from './webhook.service';
import { SlackNotificationService } from './slack.service';
import { TelegramNotificationService } from './telegram.service';
import { createModuleLogger } from 'src/common/utils/logger.util';
import { MODULE_NAME } from '../constants/module.constants';
import { NotificationChannelType } from '../interfaces/notification-channels.interface';

@Injectable()
export class MockNotificationService {
  private readonly logger = createModuleLogger(
    MockNotificationService,
    MODULE_NAME,
  );

  constructor(
    private webhookService: WebhookNotificationService,
    private slackService: SlackNotificationService,
    private telegramService: TelegramNotificationService,
  ) {}

  async sendMockNotification(
    user: User,
    notificationChannel: NotificationChannelType,
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
