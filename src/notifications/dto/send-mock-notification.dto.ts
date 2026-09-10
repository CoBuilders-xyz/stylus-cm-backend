import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  NotificationChannelType,
  NOTIFICATION_CHANNEL_TYPES,
} from '../interfaces/notification-channels.interface';

export class SendMockNotificationDto {
  @ApiProperty({
    description: 'Channel to send test notification to',
    enum: NOTIFICATION_CHANNEL_TYPES,
  })
  @IsString()
  @IsIn(NOTIFICATION_CHANNEL_TYPES)
  notificationChannel: NotificationChannelType;
}
