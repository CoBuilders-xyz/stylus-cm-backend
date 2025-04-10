import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { AlertType } from 'src/alerts/entities/alert.entity';

interface TelegramNotificationData {
  alertId: string;
  alertType: AlertType;
  destination: string;
  userId: string;
}

@Processor('notif-telegram')
export class TelegramNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(TelegramNotificationProcessor.name);

  constructor() {
    super();
  }

  async process(
    job: Job<TelegramNotificationData, void, string>,
  ): Promise<void> {
    const { alertId, alertType, destination, userId } = job.data;

    // Log notification details
    this.logger.log(`Processing Telegram notification for alert: ${alertId}`);
    this.logger.log(`Alert type: ${alertType}`);
    this.logger.log(`User ID: ${userId}`);
    this.logger.log(`Telegram chat ID: ${destination}`);
    this.logger.log(`Attempt number: ${job.attemptsMade + 1}`);

    // Here you would implement the actual Telegram notification logic
    // For example, using Telegram Bot API to send messages

    this.logger.log(`Telegram message would be sent to chat ID ${destination}`);

    // Update job progress to indicate completion
    await job.updateProgress(100);
  }
}
