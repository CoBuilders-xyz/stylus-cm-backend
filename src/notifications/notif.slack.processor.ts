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
    private readonly httpService: HttpService,
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
    this.logger.log(`Slack webhook URL: ${destination}`);

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

      // Format the alert message based on the alert type
      const message = this.formatAlertMessage(
        alertType,
        alert.value,
        contractName,
        contractAddress,
      );

      // Prepare the payload for Slack incoming webhook
      const payload = {
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `🚨 Alert: ${this.getAlertTypeDisplayName(alertType)}`,
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: message,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Contract:*\n${contractName}`,
              },
              {
                type: 'mrkdwn',
                text: `*Address:*\n\`${contractAddress}\``,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Triggered at: ${new Date().toISOString()}`,
              },
            ],
          },
        ],
      };

      // Send the notification to Slack
      await firstValueFrom(
        this.httpService.post(destination, payload).pipe(
          catchError((error: AxiosError) => {
            this.logger.error(
              `Failed to send Slack notification: ${error.message}`,
            );
            throw new Error(
              `Failed to send Slack notification: ${error.message}`,
            );
          }),
        ),
      );

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

  private formatAlertMessage(
    alertType: AlertType,
    value: string,
    contractName: string,
    contractAddress: string,
  ): string {
    // Use a short version of the contract address to include in certain messages
    const shortAddress =
      contractAddress.length > 10
        ? `${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}`
        : contractAddress;

    switch (alertType) {
      case AlertType.EVICTION:
        return `Your contract *${contractName}* (${shortAddress}) is at risk of eviction. Please take action immediately.`;

      case AlertType.NO_GAS:
        return `Your contract *${contractName}* (${shortAddress}) has run out of gas. Please refill as soon as possible.`;

      case AlertType.LOW_GAS:
        return `Your contract *${contractName}* (${shortAddress}) is running low on gas (${value || 'below threshold'}). Consider refilling soon.`;

      case AlertType.BID_SAFETY:
        return `Bid safety issue detected for contract *${contractName}* (${shortAddress}). ${value ? `Details: ${value}` : ''}`;

      default:
        return `System alert for contract *${contractName}* (${shortAddress}). ${value ? `Details: ${value}` : ''}`;
    }
  }
}
