import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { AlertType } from 'src/alerts/entities/alert.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from 'src/alerts/entities/alert.entity';
import { UserContract } from 'src/user-contracts/entities/user-contract.entity';
import { SlackNotificationService } from '../services/slack.service';

interface SlackNotificationData {
  alertId: string;
  alertType: AlertType;
  destination: string;
  userId: string;
}

@Injectable()
@Processor('notif-slack')
export class SlackNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(SlackNotificationProcessor.name);

  constructor(
    private readonly slackService: SlackNotificationService,
    @InjectRepository(Alert)
    private alertsRepository: Repository<Alert>,
    @InjectRepository(UserContract)
    private userContractsRepository: Repository<UserContract>,
  ) {
    super();
  }

  async process(job: Job<SlackNotificationData, void, string>): Promise<void> {
    const { alertId, alertType, destination, userId } = job.data;

    // Log notification details
    this.logger.log(`Processing Slack notification for alert: ${alertId}`);
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

      // Use the slack service to send the notification
      await this.slackService.sendNotification({
        destination,
        alertType,
        value: alert.value,
        contractName,
        contractAddress,
      });

      this.logger.log(`Slack notification sent successfully to ${destination}`);

      // Update job progress to indicate completion
      await job.updateProgress(100);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Error processing Slack notification: ${error.message}`,
        );
      } else {
        this.logger.error(`Error processing Slack notification: Unknown error`);
      }
      throw error; // Re-throw to let BullMQ handle retries
    }
  }
}
