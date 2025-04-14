import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { AlertType } from 'src/alerts/entities/alert.entity';

@Injectable()
export class WebhookNotificationService {
  private readonly logger = new Logger(WebhookNotificationService.name);

  constructor(private readonly httpService: HttpService) {}

  async sendNotification({
    destination,
    alertId,
    alertType,
    value,
    contractName,
    contractAddress,
    triggeredCount,
  }: {
    destination: string;
    alertId: string;
    alertType: AlertType;
    value: string;
    contractName: string;
    contractAddress: string;
    triggeredCount: number;
  }): Promise<boolean> {
    try {
      // Prepare the payload for the webhook
      const payload = {
        alertId: alertId,
        alertType: alertType,
        alertTypeDisplay: this.getAlertTypeDisplayName(alertType),
        message: this.formatAlertMessage(
          alertType,
          value,
          contractName,
          contractAddress,
        ),
        contractName,
        contractAddress,
        timestamp: new Date().toISOString(),
        value: value,
        triggeredCount: triggeredCount,
      };

      // Send the notification to the webhook endpoint
      await firstValueFrom(
        this.httpService.post(destination, payload).pipe(
          catchError((error: AxiosError) => {
            this.logger.error(
              `Failed to send webhook notification: ${error.message}`,
            );
            throw new Error(
              `Failed to send webhook notification: ${error.message}`,
            );
          }),
        ),
      );

      this.logger.log(
        `Webhook notification sent successfully to ${destination}`,
      );
      return true;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Error sending webhook notification: ${error.message}`,
        );
      } else {
        this.logger.error(`Error sending webhook notification: Unknown error`);
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
        return `Your contract ${contractName} (${shortAddress}) is at risk of eviction. Please take action immediately.`;

      case AlertType.NO_GAS:
        return `Your contract ${contractName} (${shortAddress}) has run out of gas. Please refill as soon as possible.`;

      case AlertType.LOW_GAS:
        return `Your contract ${contractName} (${shortAddress}) is running low on gas (${value || 'below threshold'}). Consider refilling soon.`;

      case AlertType.BID_SAFETY:
        return `Bid safety issue detected for contract ${contractName} (${shortAddress}). ${value ? `Details: ${value}` : ''}`;

      default:
        return `System alert for contract ${contractName} (${shortAddress}). ${value ? `Details: ${value}` : ''}`;
    }
  }
}
