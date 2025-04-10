import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { AlertType } from 'src/alerts/entities/alert.entity';

interface SlackNotificationData {
  alertId: string;
  alertType: AlertType;
  destination: string;
  userId: string;
}

@Processor('notif-slack')
export class SlackNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(SlackNotificationProcessor.name);

  constructor() {
    super();
  }

  async process(job: Job<SlackNotificationData, void, string>): Promise<void> {
    const { alertId, alertType, destination, userId } = job.data;

    // Log notification details
    this.logger.log(`Processing Slack notification for alert: ${alertId}`);
    this.logger.log(`Alert type: ${alertType}`);
    this.logger.log(`User ID: ${userId}`);
    this.logger.log(`Slack channel/webhook: ${destination}`);

    // Here you would implement the actual Slack notification logic
    // For example, using an API client to send the message to Slack

    this.logger.log(`Slack notification would be sent to ${destination}`);

    // Update job progress to indicate completion
    await job.updateProgress(100);
  }
}
