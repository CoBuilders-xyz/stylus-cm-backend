import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alert } from 'src/alerts/entities/alert.entity';
import { User } from 'src/users/entities/user.entity';
import { AlertsConsumer } from './alerts.processor';
import { SlackNotificationProcessor } from './notif.slack.processor';
import { TelegramNotificationProcessor } from './notif.telegram.processor';
import { EmailNotificationProcessor } from './notif.email.processor';
import { WebhookNotificationProcessor } from './notif.webhook.processor';
import { HttpModule } from '@nestjs/axios';
import { UserContract } from 'src/user-contracts/entities/user-contract.entity';
import { NotificationsController } from './notifications.controller';
import { EmailNotificationService } from './notif.email.service';
import { SlackNotificationService } from './notif.slack.service';
import { TelegramNotificationService } from './notif.telegram.service';
import { WebhookNotificationService } from './notif.webhook.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alert, User, UserContract]),
    HttpModule,
    BullModule.registerQueue({
      name: 'notif-slack',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: false,
        removeOnFail: false,
      },
    }),
    BullModule.registerQueue({
      name: 'notif-telegram',
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: false,
        removeOnFail: false,
      },
    }),
    BullModule.registerQueue({
      name: 'notif-email',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }),
    BullModule.registerQueue({
      name: 'notif-webhook',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    AlertsConsumer,
    SlackNotificationProcessor,
    TelegramNotificationProcessor,
    EmailNotificationProcessor,
    WebhookNotificationProcessor,
    EmailNotificationService,
    SlackNotificationService,
    TelegramNotificationService,
    WebhookNotificationService,
  ],
  exports: [
    NotificationsService,
    EmailNotificationService,
    SlackNotificationService,
    TelegramNotificationService,
    WebhookNotificationService,
  ],
})
export class NotificationsModule {}
