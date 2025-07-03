import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { AlertType } from 'src/alerts/entities/alert.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from 'src/alerts/entities/alert.entity';
import { UserContract } from 'src/user-contracts/entities/user-contract.entity';
import { WebhookNotificationService } from '../services/webhook.service';

interface WebhookNotificationData {
  alertId: string;
  alertType: AlertType;
  destination: string;
  userId: string;
}

@Injectable()
@Processor('notif-webhook')
export class WebhookNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookNotificationProcessor.name);

  constructor(
    private readonly webhookService: WebhookNotificationService,
    @InjectRepository(Alert)
    private alertsRepository: Repository<Alert>,
    @InjectRepository(UserContract)
    private userContractsRepository: Repository<UserContract>,
  ) {
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

    try {
      // Fetch the alert details to get more context
      const alert = await this.alertsRepository.findOne({
        where: { id: alertId },
        relations: ['user', 'userContract'],
      });

      if (!alert) {
        throw new Error(`Alert with ID ${alertId} not found`);
      }

      let contractAddress = 'Not available';
      let contractName = 'Not available';

      if (alert.userContract) {
        contractAddress = alert.userContract.address;
        contractName = alert.userContract.name || 'Unknown contract';
      }

      // Use the webhook service to send the notification
      await this.webhookService.sendNotification({
        destination,
        alertId,
        alertType,
        value: alert.value,
        contractName,
        contractAddress,
        triggeredCount: alert.triggeredCount,
      });

      this.logger.log(
        `Webhook notification sent successfully to ${destination}`,
      );

      // Update job progress to indicate completion
      await job.updateProgress(100);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Error processing Webhook notification: ${error.message}`,
        );
      } else {
        this.logger.error(
          `Error processing Webhook notification: Unknown error`,
        );
      }
      throw error; // Re-throw to let BullMQ handle retries
    }
  }
}
