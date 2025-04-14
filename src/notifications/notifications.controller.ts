import { Controller, Post, Body, Logger, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Public } from 'src/auth/auth.guard';
import { AuthenticatedRequest } from 'src/common/types/custom-types';

/**
 * Controller for testing webhook functionality
 */
@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Endpoint for receiving test webhooks (use this URL as your webhook destination to test)
   * This endpoint is public to allow external services to call it
   */
  @Post('test/webhook/receive')
  @Public()
  receiveTestWebhook(@Body() payload: any) {
    this.logger.log('Received test webhook payload');
    this.logger.log(JSON.stringify(payload));
    // randomly throw an error
    if (Math.random() > 0.5) {
      throw new Error('Webhook Test error');
    }
    return {
      success: true,
      message: 'Webhook received successfully',
      timestamp: new Date(),
    };
  }

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
