import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { AlertType } from 'src/alerts/entities/alert.entity';

@Injectable()
export class SlackNotificationService {
  private readonly logger = new Logger(SlackNotificationService.name);

  constructor(private readonly httpService: HttpService) {}

  async sendNotification({
    destination,
    alertType,
    value,
    contractName,
    contractAddress,
  }: {
    destination: string;
    alertType: AlertType;
    value: string;
    contractName: string;
    contractAddress: string;
  }): Promise<boolean> {
    try {
      // Format the alert message based on the alert type
      const message = this.formatAlertMessage(
        alertType,
        value,
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
      return true;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Error sending Slack notification: ${error.message}`);
      } else {
        this.logger.error(`Error sending Slack notification: Unknown error`);
      }
      throw error;
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
