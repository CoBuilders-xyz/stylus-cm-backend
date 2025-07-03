import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AlertType } from 'src/alerts/entities/alert.entity';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import * as http from 'http';
import * as https from 'https';

@Injectable()
export class TelegramNotificationService {
  private readonly logger = new Logger(TelegramNotificationService.name);
  private readonly telegramBaseUrl: string;
  private readonly botToken: string | undefined;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // Get the bot token from environment variables
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.telegramBaseUrl = `https://api.telegram.org/bot${this.botToken || ''}`;

    // Configure HttpService to use IPv4 only
    this.httpService.axiosRef.defaults.httpAgent = new http.Agent({
      family: 4,
    });
    this.httpService.axiosRef.defaults.httpsAgent = new https.Agent({
      family: 4,
    });
    this.httpService.axiosRef.defaults.timeout = 30000; // 30 second timeout

    // Log if token is available or not at service initialization
    if (!this.botToken) {
      this.logger.warn('Telegram bot token is not configured');
    } else {
      this.logger.log('Telegram bot token is configured');
      // Log a masked version of the token for debugging
      const maskedToken =
        this.botToken.substring(0, 5) +
        '...' +
        this.botToken.substring(this.botToken.length - 4);
      this.logger.log(`Using bot token: ${maskedToken}`);
    }

    this.logger.log('Telegram service configured to use IPv4 only');
  }

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
    alertId?: string;
    recipientName?: string;
    triggeredCount?: number;
  }): Promise<boolean> {
    try {
      // Check if bot token is configured
      if (!this.botToken) {
        throw new Error('Telegram bot token is not configured');
      }

      this.logger.log(
        `Preparing to send Telegram notification to chat ID: ${destination}`,
      );
      this.logger.log(`Alert type: ${alertType}, Contract: ${contractName}`);

      // Format the alert message based on the alert type
      const message = this.formatAlertMessage(
        alertType,
        value,
        contractName,
        contractAddress,
      );

      // Prepare the payload for Telegram sendMessage API
      const payload = {
        chat_id: destination,
        text: message,
        parse_mode: 'Markdown',
      };

      // Log the API endpoint being called
      const apiEndpoint = `${this.telegramBaseUrl}/sendMessage`;
      this.logger.log(`Calling Telegram API endpoint: ${apiEndpoint}`);
      this.logger.log(`With payload: ${JSON.stringify(payload)}`);
      this.logger.log(`Using IPv4 only configuration`);

      // Send the notification to Telegram using HttpService
      const response = await firstValueFrom(
        this.httpService.post(apiEndpoint, payload, {
          headers: {
            'Content-Type': 'application/json',
          },
          validateStatus: (status) => status < 500,
        }),
      );

      if (response.status >= 200 && response.status < 300) {
        this.logger.log(
          `Telegram API response: ${JSON.stringify(response.data)}`,
        );
        this.logger.log(
          `Telegram notification sent successfully to chat ID ${destination}`,
        );
        return true;
      } else {
        throw new Error(
          `Telegram API returned status ${response.status}: ${JSON.stringify(response.data)}`,
        );
      }
    } catch (error) {
      if (error instanceof AxiosError) {
        this.logger.error(
          `Error sending Telegram notification: ${error.message}`,
          error.stack,
        );
        // Log more helpful information for network errors
        if (error.code) {
          this.logger.error(`Network error code: ${error.code}`);
        }
      } else if (error instanceof Error) {
        this.logger.error(
          `Error sending Telegram notification: ${error.message}`,
        );
      } else {
        this.logger.error(`Error sending Telegram notification: Unknown error`);
      }
      throw error;
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
