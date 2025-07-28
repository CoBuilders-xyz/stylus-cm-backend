import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AlertType } from 'src/alerts/entities/alert.entity';
import { catchError, firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import * as http from 'http';
import * as https from 'https';
import { createModuleLogger } from 'src/common/utils/logger.util';
import { MODULE_NAME } from '../constants/module.constants';

@Injectable()
export class TelegramNotificationService {
  private readonly logger = createModuleLogger(
    TelegramNotificationService,
    MODULE_NAME,
  );
  private readonly telegramBaseUrl: string;
  private readonly telegramBotToken: string | undefined;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // Get the bot token from environment variables
    this.telegramBotToken =
      this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.telegramBaseUrl = `https://api.telegram.org/bot${this.telegramBotToken || ''}`;

    // Configure HttpService to use IPv4 only
    this.httpService.axiosRef.defaults.httpAgent = new http.Agent({
      family: 4,
    });
    this.httpService.axiosRef.defaults.httpsAgent = new https.Agent({
      family: 4,
    });
    this.httpService.axiosRef.defaults.timeout = 30000; // 30 second timeout

    // Log if token is available or not at service initialization
    if (!this.telegramBotToken) {
      this.logger.debug('Telegram bot token is not configured');
    } else {
      this.logger.debug('Telegram bot token is configured');
    }

    this.logger.debug('Telegram service configured to use IPv4 only');
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
    this.logger.log(
      `Sending Telegram notification to chat for alert type: ${alertType}`,
    );
    this.logger.debug(
      `Telegram details: contract=${contractName}, chatId=${destination}`,
    );

    try {
      // Check if Telegram Bot Token is configured
      if (!this.telegramBotToken) {
        this.logger.log(
          'Telegram bot token not configured - skipping Telegram notification',
        );
        throw new Error('Telegram Bot Token is not configured');
      }

      // Create the message text
      const message = this.formatAlertMessage(
        alertType,
        value,
        contractName,
        contractAddress,
      );

      // Prepare the payload for Telegram API
      const payload = {
        chat_id: destination,
        text: message,
        parse_mode: 'Markdown',
      };

      this.logger.debug(
        `Telegram message: ${this.getAlertTypeDisplayName(alertType)} for ${contractName}`,
      );

      // Send the notification using Telegram Bot API
      const url = `${this.telegramBaseUrl}/sendMessage`;

      await firstValueFrom(
        this.httpService.post(url, payload).pipe(
          catchError((error: AxiosError) => {
            this.logger.error(
              `Failed to send Telegram message: ${error.message}`,
            );
            throw new Error(
              `Failed to send Telegram notification: ${error.message}`,
            );
          }),
        ),
      );

      this.logger.log(`Successfully sent Telegram notification to chat`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send Telegram notification to ${destination}`,
        error,
      );
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
