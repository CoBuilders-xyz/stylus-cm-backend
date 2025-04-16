import { Controller, Post, Body, Logger, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthenticatedRequest } from 'src/common/types/custom-types';

/**
 * Controller for testing webhook functionality
 */
@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('test/send')
  sendMockNotification(
    @Body()
    payload: {
      userAddress: string;
      notificationChannel: 'webhook' | 'slack' | 'telegram' | 'email';
    },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.notificationsService.sendMockNotification(
      req.user,
      payload.notificationChannel,
    );
  }
}
