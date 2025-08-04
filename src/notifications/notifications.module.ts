import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alert } from 'src/alerts/entities/alert.entity';
import { User } from 'src/users/entities/user.entity';
import { AlertsConsumer } from './processors/alerts.processor';
import {
  SlackNotificationProcessor,
  TelegramNotificationProcessor,
  WebhookNotificationProcessor,
} from './processors';
import { HttpModule } from '@nestjs/axios';
import { UserContract } from 'src/user-contracts/entities/user-contract.entity';
import { NotificationsController } from './notifications.controller';
import {
  SlackNotificationService,
  TelegramNotificationService,
  WebhookNotificationService,
  NotificationQueueService,
  MockNotificationService,
  TimingService,
} from './services';

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
    WebhookNotificationProcessor,
    SlackNotificationService,
    TelegramNotificationService,
    WebhookNotificationService,
    NotificationQueueService,
    MockNotificationService,
    TimingService,
  ],
  exports: [
    NotificationsService,
    SlackNotificationService,
    TelegramNotificationService,
    WebhookNotificationService,
    NotificationQueueService,
    MockNotificationService,
    TimingService,
  ],
})
export class NotificationsModule {}
