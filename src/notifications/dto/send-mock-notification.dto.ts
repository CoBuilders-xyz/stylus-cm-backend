import { IsString, IsIn } from 'class-validator';

export class SendMockNotificationDto {
  @IsString()
  @IsIn(['webhook', 'slack', 'telegram', 'email'])
  notificationChannel: 'webhook' | 'slack' | 'telegram' | 'email';
}
