import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { AlertType } from 'src/alerts/entities/alert.entity';

interface WebhookNotificationData {
  alertId: string;
  alertType: AlertType;
  destination: string;
  userId: string;
}

@Processor('notif-webhook')
export class WebhookNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookNotificationProcessor.name);

  constructor() {
    super();
  }

  async process(
    job: Job<WebhookNotificationData, void, string>,
  ): Promise<void> {
    const { alertId, alertType, destination, userId } = job.data;

    // Log notification details
    this.logger.log(`Processing Webhook notification for alert: ${alertId}`);
    this.logger.log(`Attempt number: ${job.attemptsMade + 1}`);
    this.logger.log(`Alert type: ${alertType}`);
    this.logger.log(`User ID: ${userId}`);
    this.logger.log(`Webhook URL: ${destination}`);

    // Here you would implement the actual webhook notification logic
    // For example, making an HTTP POST request to the webhook URL

    this.logger.log(`Webhook notification would be sent to ${destination}`);

    // Update job progress to indicate completion
    await job.updateProgress(100);
  }
}
