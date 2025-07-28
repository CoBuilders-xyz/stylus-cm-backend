import { IsString, IsIn } from 'class-validator';

export class SendMockNotificationDto {
  @IsString()
  @IsIn(['webhook', 'slack', 'telegram'])
  notificationChannel: 'webhook' | 'slack' | 'telegram';
}
