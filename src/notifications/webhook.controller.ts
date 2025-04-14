import { Controller, Post, Body, Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Public } from 'src/auth/auth.guard';

/**
 * Controller for testing webhook functionality
 */
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Endpoint for receiving test webhooks (use this URL as your webhook destination to test)
   * This endpoint is public to allow external services to call it
   */
  @Post('test/receive')
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
}
