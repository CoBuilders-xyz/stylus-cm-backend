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

@Module({
  imports: [
    TypeOrmModule.forFeature([Alert, User, UserContract]),
    HttpModule,
    BullModule.registerQueue({
      name: 'notif-slack',
    }),
    BullModule.registerQueue({
      name: 'notif-telegram',
    }),
    BullModule.registerQueue({
      name: 'notif-email',
    }),
    BullModule.registerQueue({
      name: 'notif-webhook',
    }),
  ],
  providers: [
    NotificationsService,
    AlertsConsumer,
    SlackNotificationProcessor,
    TelegramNotificationProcessor,
    EmailNotificationProcessor,
    WebhookNotificationProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
