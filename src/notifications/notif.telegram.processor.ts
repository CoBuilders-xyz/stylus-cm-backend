import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { AlertType } from 'src/alerts/entities/alert.entity';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from 'src/alerts/entities/alert.entity';
import { UserContract } from 'src/user-contracts/entities/user-contract.entity';
import { AxiosError } from 'axios';
import { ConfigService } from '@nestjs/config';

interface TelegramNotificationData {
  alertId: string;
  alertType: AlertType;
  destination: string; // This is the Telegram chat ID
  userId: string;
}

@Injectable()
@Processor('notif-telegram')
export class TelegramNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(TelegramNotificationProcessor.name);
  private readonly telegramBaseUrl: string;
  private readonly botToken: string | undefined;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(Alert)
    private alertsRepository: Repository<Alert>,
    @InjectRepository(UserContract)
    private userContractsRepository: Repository<UserContract>,
  ) {
    super();
    // Get the bot token from environment variables
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.telegramBaseUrl = `https://api.telegram.org/bot${this.botToken || ''}`;
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
    this.logger.log(`Telegram chat ID: ${destination}`);

    try {
      // Check if bot token is configured
      if (!this.botToken) {
        throw new Error('Telegram bot token is not configured');
      }

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

      // Format the alert message based on the alert type
      const message = this.formatAlertMessage(
        alertType,
        alert.value,
        contractName,
        contractAddress,
      );

      // Prepare the payload for Telegram sendMessage API
      const payload = {
        chat_id: destination,
        text: message,
        parse_mode: 'Markdown',
      };

      // Send the notification to Telegram
      await firstValueFrom(
        this.httpService
          .post(`${this.telegramBaseUrl}/sendMessage`, payload)
          .pipe(
            catchError((error: AxiosError) => {
              const errorMessage = error.response?.data
                ? JSON.stringify(error.response.data)
                : error.message;
              this.logger.error(
                `Failed to send Telegram notification: ${errorMessage}`,
              );
              throw new Error(
                `Failed to send Telegram notification: ${errorMessage}`,
              );
            }),
          ),
      );

      this.logger.log(
        `Telegram notification sent successfully to chat ID ${destination}`,
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

  private getAlertTypeEmoji(alertType: AlertType): string {
    switch (alertType) {
      case AlertType.EVICTION:
        return '⚠️';
      case AlertType.NO_GAS:
        return '⛽';
      case AlertType.LOW_GAS:
        return '🔋';
      case AlertType.BID_SAFETY:
        return '🔒';
      default:
        return '🚨';
    }
  }

  private formatAlertMessage(
    alertType: AlertType,
    value: string,
    contractName: string,
    contractAddress: string,
  ): string {
    const emoji = this.getAlertTypeEmoji(alertType);
    const alertTypeName = this.getAlertTypeDisplayName(alertType);
    const timestamp = new Date().toISOString();

    // Build a nicely formatted Telegram message
    let message = `${emoji} *ALERT: ${alertTypeName}* ${emoji}\n\n`;

    // Add alert-specific message
    switch (alertType) {
      case AlertType.EVICTION:
        message += `Your contract *${contractName}* is at risk of eviction. Please take action immediately.\n`;
        break;
      case AlertType.NO_GAS:
        message += `Your contract *${contractName}* has run out of gas. Please refill as soon as possible.\n`;
        break;
      case AlertType.LOW_GAS:
        message += `Your contract *${contractName}* is running low on gas (${value || 'below threshold'}). Consider refilling soon.\n`;
        break;
      case AlertType.BID_SAFETY:
        message += `Bid safety issue detected for contract *${contractName}*.\n`;
        if (value) {
          message += `Details: ${value}\n`;
        }
        break;
      default:
        message += `System alert for contract *${contractName}*.\n`;
        if (value) {
          message += `Details: ${value}\n`;
        }
    }

    // Add contract details
    message += `\n*Contract Details:*\n`;
    message += `• Name: *${contractName}*\n`;
    message += `• Address: \`${contractAddress}\`\n`;
    message += `\n_Triggered at: ${timestamp}_`;

    return message;
  }

  private getAlertTypeDisplayName(alertType: AlertType): string {
    switch (alertType) {
      case AlertType.EVICTION:
        return 'Eviction Risk';
      case AlertType.NO_GAS:
        return 'No Gas';
      case AlertType.LOW_GAS:
        return 'Low Gas';
      case AlertType.BID_SAFETY:
        return 'Bid Safety Issue';
      default:
        return 'System Alert';
    }
  }
}
