import { Controller, Post, Body, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { AuthenticatedRequest } from 'src/common/types/custom-types';
import { SendMockNotificationDto } from './dto';
import { createControllerLogger } from 'src/common/utils/logger.util';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  private readonly logger = createControllerLogger(
    NotificationsController,
    'Notifications',
  );

  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('test/send')
  @ApiOperation({ summary: 'Send a test notification to verify channel configuration' })
  @ApiResponse({ status: 201, description: 'Mock notification sent' })
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
