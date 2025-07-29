import { IsString, IsIn } from 'class-validator';
import {
  NotificationChannelType,
  NOTIFICATION_CHANNEL_TYPES,
} from '../interfaces/notification-channels.interface';

export class SendMockNotificationDto {
  @IsString()
  @IsIn(NOTIFICATION_CHANNEL_TYPES)
  notificationChannel: NotificationChannelType;
}
