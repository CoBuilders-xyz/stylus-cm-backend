import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { AlertType } from 'src/alerts/entities/alert.entity';

interface EmailNotificationData {
  alertId: string;
  alertType: AlertType;
  destination: string;
  userId: string;
}

@Processor('notif-email')
export class EmailNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailNotificationProcessor.name);

  constructor() {
    super();
  }

  async process(job: Job<EmailNotificationData, void, string>): Promise<void> {
    const { alertId, alertType, destination, userId } = job.data;

    // Log notification details
    this.logger.log(`Processing Email notification for alert: ${alertId}`);
    this.logger.log(`Attempt number: ${job.attemptsMade + 1}`);
    this.logger.log(`Alert type: ${alertType}`);
    this.logger.log(`User ID: ${userId}`);
    this.logger.log(`Email address: ${destination}`);

    // Here you would implement the actual email notification logic
    // For example, using a service like Nodemailer or an email API

    this.logger.log(`Email would be sent to ${destination}`);

    // Update job progress to indicate completion
    await job.updateProgress(100);
  }
}
