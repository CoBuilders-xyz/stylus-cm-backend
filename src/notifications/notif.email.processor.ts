import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { AlertType } from 'src/alerts/entities/alert.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from 'src/alerts/entities/alert.entity';
import { UserContract } from 'src/user-contracts/entities/user-contract.entity';
import { EmailNotificationService } from './notif.email.service';

interface EmailNotificationData {
  alertId: string;
  alertType: AlertType;
  destination: string;
  userId: string;
}

@Injectable()
@Processor('notif-email')
export class EmailNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailNotificationProcessor.name);

  constructor(
    private readonly emailService: EmailNotificationService,
    @InjectRepository(Alert)
    private alertsRepository: Repository<Alert>,
    @InjectRepository(UserContract)
    private userContractsRepository: Repository<UserContract>,
  ) {
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

      // Create recipient name from user data or use a default
      const recipientName = alert.user?.name || 'Stylus User';

      // Use the email service to send the notification
      await this.emailService.sendNotification({
        destination,
        recipientName,
        alertType,
        value: alert.value,
        contractName,
        contractAddress,
      });

      this.logger.log(`Email notification sent successfully to ${destination}`);

      // Update job progress to indicate completion
      await job.updateProgress(100);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Error processing email notification: ${error.message}`,
        );
      } else {
        this.logger.error(`Error processing email notification: Unknown error`);
      }
      throw error; // Re-throw to let BullMQ handle retries
    }
  }
}
