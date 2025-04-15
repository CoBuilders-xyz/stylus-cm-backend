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
  private readonly sendGridApiKey: string | undefined;
  private readonly sendGridApiUrl = 'https://api.sendgrid.com/v3/mail/send';
  private readonly senderEmail: string;
  private readonly senderName: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(Alert)
    private alertsRepository: Repository<Alert>,
    @InjectRepository(UserContract)
    private userContractsRepository: Repository<UserContract>,
  ) {
    super();
    this.sendGridApiKey = this.configService.get<string>('SEND_GRID_TOKEN');
    this.senderEmail =
      this.configService.get<string>('SENDGRID_SENDER_EMAIL') ||
      'test@example.com';
    this.senderName =
      this.configService.get<string>('SENDGRID_SENDER_NAME') ||
      'Stylus Monitor Alerts';
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
      // Check if SendGrid API key is configured
      if (!this.sendGridApiKey) {
        throw new Error('SendGrid API key is not configured');
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

      // Create email content
      const { subject, htmlContent, textContent } = this.createEmailContent(
        alertType,
        alert.value,
        contractName,
        contractAddress,
      );

      // Create recipient name from user data or use a default
      const recipientName = alert.user?.name || 'Stylus User';

      // Prepare the payload for SendGrid API
      const payload = {
        personalizations: [
          {
            to: [
              {
                email: destination,
                name: recipientName,
              },
            ],
            subject: subject,
          },
        ],
        from: {
          email: this.senderEmail,
          name: this.senderName,
        },
        reply_to: {
          email: this.senderEmail,
          name: this.senderName,
        },
        content: [
          {
            type: 'text/plain',
            value: textContent,
          },
          {
            type: 'text/html',
            value: htmlContent,
          },
        ],
      };

      // Send the notification using SendGrid API
      await firstValueFrom(
        this.httpService
          .post(this.sendGridApiUrl, payload, {
            headers: {
              Authorization: `Bearer ${this.sendGridApiKey}`,
              'Content-Type': 'application/json',
            },
          })
          .pipe(
            catchError((error: AxiosError) => {
              const statusCode = error.response?.status;
              const errorData = error.response?.data;

              this.logger.error(
                `Failed to send email notification: Status Code: ${statusCode || 'unknown'}`,
              );

              if (errorData) {
                this.logger.error(
                  `Error details: ${JSON.stringify(errorData)}`,
                );
              }

              throw new Error(
                `Failed to send email notification: ${error.message}`,
              );
            }),
          ),
      );

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

  private createEmailContent(
    alertType: AlertType,
    value: string,
    contractName: string,
    contractAddress: string,
  ): { subject: string; htmlContent: string; textContent: string } {
    const alertTypeName = this.getAlertTypeDisplayName(alertType);
    const timestamp = new Date().toISOString();

    // Create subject line
    const subject = `Alert: ${alertTypeName} for Contract ${contractName}`;

    // Create plain text content
    let textContent = `ALERT: ${alertTypeName}\n\n`;

    switch (alertType) {
      case AlertType.EVICTION:
        textContent += `Your contract ${contractName} is at risk of eviction. Please take action immediately.\n\n`;
        break;
      case AlertType.NO_GAS:
        textContent += `Your contract ${contractName} has run out of gas. Please refill as soon as possible.\n\n`;
        break;
      case AlertType.LOW_GAS:
        textContent += `Your contract ${contractName} is running low on gas (${value || 'below threshold'}). Consider refilling soon.\n\n`;
        break;
      case AlertType.BID_SAFETY:
        textContent += `Bid safety issue detected for contract ${contractName}.\n`;
        if (value) {
          textContent += `Details: ${value}\n\n`;
        }
        break;
      default:
        textContent += `System alert for contract ${contractName}.\n`;
        if (value) {
          textContent += `Details: ${value}\n\n`;
        }
    }

    textContent += `Contract Details:\n`;
    textContent += `Name: ${contractName}\n`;
    textContent += `Address: ${contractAddress}\n\n`;
    textContent += `Triggered at: ${timestamp}`;

    // Create HTML content
    let htmlContent = `<html><head><style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
      .container { max-width: 600px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 5px; overflow: hidden; }
      .header { background-color: #f8f9fa; padding: 20px; text-align: center; border-bottom: 1px solid #e1e1e1; }
      .content { padding: 20px; }
      .alert-title { font-size: 22px; font-weight: bold; margin-bottom: 20px; color: #d9534f; }
      .alert-message { font-size: 16px; line-height: 1.5; margin-bottom: 20px; }
      .contract-details { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
      .detail-row { margin-bottom: 10px; }
      .label { font-weight: bold; }
      .footer { font-size: 12px; color: #777; text-align: center; margin-top: 20px; font-style: italic; }
      .address { font-family: monospace; background-color: #eee; padding: 5px; border-radius: 3px; }
    </style></head><body><div class="container">
      <div class="header"><h2>Stylus Monitor Alert</h2></div>
      <div class="content">
        <div class="alert-title">⚠️ ${alertTypeName}</div>
        <div class="alert-message">`;

    switch (alertType) {
      case AlertType.EVICTION:
        htmlContent += `<p>Your contract <strong>${contractName}</strong> is at risk of eviction. Please take action immediately.</p>`;
        break;
      case AlertType.NO_GAS:
        htmlContent += `<p>Your contract <strong>${contractName}</strong> has run out of gas. Please refill as soon as possible.</p>`;
        break;
      case AlertType.LOW_GAS:
        htmlContent += `<p>Your contract <strong>${contractName}</strong> is running low on gas (${value || 'below threshold'}). Consider refilling soon.</p>`;
        break;
      case AlertType.BID_SAFETY:
        htmlContent += `<p>Bid safety issue detected for contract <strong>${contractName}</strong>.</p>`;
        if (value) {
          htmlContent += `<p>Details: ${value}</p>`;
        }
        break;
      default:
        htmlContent += `<p>System alert for contract <strong>${contractName}</strong>.</p>`;
        if (value) {
          htmlContent += `<p>Details: ${value}</p>`;
        }
    }

    htmlContent += `</div>
        <div class="contract-details">
          <div class="detail-row"><span class="label">Contract Name:</span> ${contractName}</div>
          <div class="detail-row"><span class="label">Contract Address:</span> <span class="address">${contractAddress}</span></div>
        </div>
        <div class="footer">Triggered at: ${timestamp}</div>
      </div>
    </div></body></html>`;

    return { subject, htmlContent, textContent };
  }
}
