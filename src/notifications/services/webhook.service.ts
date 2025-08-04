import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { AlertType } from 'src/alerts/entities/alert.entity';
import { createModuleLogger } from 'src/common/utils/logger.util';
import { MODULE_NAME } from '../constants/module.constants';

@Injectable()
export class WebhookNotificationService {
  private readonly logger = createModuleLogger(
    WebhookNotificationService,
    MODULE_NAME,
  );

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
    triggeredCount?: number;
  }): Promise<boolean> {
    this.logger.log(
      `Sending webhook notification for alert type: ${alertType}`,
    );
    this.logger.debug(
      `Webhook details: contract=${contractName}, destination=${destination}`,
    );

    try {
      // Prepare the payload for the webhook
      const payload = {
        alertId,
        alertType,
        alertTypeDisplay: this.getAlertTypeDisplayName(alertType),
        value,
        contractName,
        contractAddress,
        triggeredCount: triggeredCount || 1,
        timestamp: new Date().toISOString(),
        message: this.formatAlertMessage(
          alertType,
          value,
          contractName,
          contractAddress,
        ),
      };

      this.logger.debug(`Webhook payload for alert: ${alertId}`);

      // Send the notification to the webhook URL
      await firstValueFrom(
        this.httpService.post(destination, payload).pipe(
          catchError((error: AxiosError) => {
            this.logger.error(`Failed to send webhook: ${error.message}`);
            throw new Error(
              `Failed to send webhook notification: ${error.message}`,
            );
          }),
        ),
      );

      this.logger.log(
        `Successfully sent webhook notification for alert: ${alertId}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send webhook notification to ${destination}`,
        error,
      );
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
        return `Your contract ${contractName} (${shortAddress}) has been evicted. Please take action immediately.`;

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
