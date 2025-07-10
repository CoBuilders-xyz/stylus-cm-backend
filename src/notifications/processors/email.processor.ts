import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from 'src/alerts/entities/alert.entity';
import { EmailNotificationService } from '../services/email.service';
import { EmailNotificationData } from '../interfaces';
import { createContextLogger } from 'src/common/utils/logger.util';

@Processor('notif-email')
export class EmailNotificationProcessor extends WorkerHost {
  private readonly logger = createContextLogger(
    'EmailProcessor',
    'Notifications',
  );

  constructor(
    private readonly emailService: EmailNotificationService,
    @InjectRepository(Alert)
    private alertsRepository: Repository<Alert>,
  ) {
    super();
  }

  async process(job: Job<EmailNotificationData, any, string>): Promise<void> {
    const { alertId, destination, userId } = job.data;

    this.logger.log(`Processing Email notification job for alert: ${alertId}`);
    this.logger.debug(
      `Job details: destination=${destination}, userId=${userId}`,
    );

    try {
      const alert = await this.alertsRepository.findOne({
        where: { id: alertId },
        relations: ['userContract', 'user'],
      });

      if (!alert) {
        this.logger.log(`Alert not found: ${alertId} - skipping notification`);
        return;
      }

      this.logger.debug(
        `Processing Email notification for alert type: ${alert.type}`,
      );

      const recipientName = alert.user?.name || 'Stylus User';

      await this.emailService.sendNotification({
        destination,
        recipientName,
        alertType: alert.type,
        value: alert.value,
        contractName: alert.userContract?.name || 'Unknown Contract',
        contractAddress: alert.userContract?.address || 'Unknown Address',
        triggeredCount: alert.triggeredCount,
      });

      this.logger.log(
        `Successfully sent Email notification for alert: ${alertId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing Email notification for alert: ${alertId}`,
        error,
      );
      throw error;
    }
  }
}
