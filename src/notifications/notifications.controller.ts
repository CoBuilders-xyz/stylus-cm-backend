import { Controller, Post, Body, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthenticatedRequest } from 'src/common/types/custom-types';
import { SendMockNotificationDto } from './dto';
import { createControllerLogger } from 'src/common/utils/logger.util';

/**
 * Controller for testing webhook functionality
 */
@Controller('notifications')
export class NotificationsController {
  private readonly logger = createControllerLogger(
    NotificationsController,
    'Notifications',
  );

  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('test/send')
  async sendMockNotification(
    @Body() payload: SendMockNotificationDto,
    @Request() req: AuthenticatedRequest,
  ) {
    this.logger.log(
      `Sending mock ${payload.notificationChannel} notification for user: ${req.user.id}`,
    );

    const result = await this.notificationsService.sendMockNotification(
      req.user,
      payload.notificationChannel,
    );

    this.logger.debug(`Mock notification result: ${JSON.stringify(result)}`);
    return result;
  }
}
