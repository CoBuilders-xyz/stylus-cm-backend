import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { AlertType } from 'src/alerts/entities/alert.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from 'src/alerts/entities/alert.entity';
import { UserContract } from 'src/user-contracts/entities/user-contract.entity';
import { TelegramNotificationService } from '../services/telegram-notification.service';

interface TelegramNotificationData {
  alertId: string;
  alertType: AlertType;
  destination: string;
  userId: string;
}

@Injectable()
@Processor('notif-telegram')
export class TelegramNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(TelegramNotificationProcessor.name);

  constructor(
    private readonly telegramService: TelegramNotificationService,
    @InjectRepository(Alert)
    private alertsRepository: Repository<Alert>,
    @InjectRepository(UserContract)
    private userContractsRepository: Repository<UserContract>,
  ) {
    super();
  }

  async process(
    job: Job<TelegramNotificationData, void, string>,
  ): Promise<void> {
    const { alertId, alertType, destination, userId } = job.data;

    // Log notification details
    this.logger.log(`Processing Telegram notification for alert: ${alertId}`);
    this.logger.log(`Attempt number: ${job.attemptsMade + 1}`);
    this.logger.log(`Alert type: ${alertType}`);
    this.logger.log(`User ID: ${userId}`);
    this.logger.log(`Chat ID: ${destination}`);

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

      // Use the telegram service to send the notification
      await this.telegramService.sendNotification({
        destination,
        alertType,
        value: alert.value,
        contractName,
        contractAddress,
      });

      this.logger.log(
        `Telegram notification sent successfully to ${destination}`,
      );

      // Update job progress to indicate completion
      await job.updateProgress(100);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Error processing Telegram notification: ${error.message}`,
        );
      } else {
        this.logger.error(
          `Error processing Telegram notification: Unknown error`,
        );
      }
      throw error; // Re-throw to let BullMQ handle retries
    }
  }
}
