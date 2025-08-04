import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from 'src/alerts/entities/alert.entity';
import { WebhookNotificationService } from '../services/webhook.service';
import { BaseProcessorData } from '../interfaces';
import { createContextLogger } from 'src/common/utils/logger.util';
import { TimingService } from '../services/timing.service';

@Processor('notif-webhook')
export class WebhookNotificationProcessor extends WorkerHost {
  private readonly logger = createContextLogger(
    'WebhookProcessor',
    'Notifications',
  );

  constructor(
    private readonly webhookService: WebhookNotificationService,
    private readonly timingService: TimingService,
    @InjectRepository(Alert)
    private alertsRepository: Repository<Alert>,
  ) {
    super();
  }

  async process(job: Job<BaseProcessorData, any, string>): Promise<void> {
    const { alertId, destination, userId } = job.data;

    this.logger.log(
      `Processing Webhook notification job for alert: ${alertId}`,
    );
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
        `Processing Webhook notification for alert type: ${alert.type}`,
      );

      await this.webhookService.sendNotification({
        destination,
        alertId: alert.id,
        alertType: alert.type,
        value: alert.value,
        contractName: alert.userContract?.name || 'Unknown Contract',
        contractAddress: alert.userContract?.address || 'Unknown Address',
        triggeredCount: alert.triggeredCount,
      });

      // Update lastNotified timestamp
      const updatedAlert = this.timingService.updateLastNotified(alert);
      await this.alertsRepository.save(updatedAlert);

      this.logger.log(
        `Successfully sent Webhook notification for alert: ${alertId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing Webhook notification for alert: ${alertId}`,
        error,
      );
      throw error;
    }
  }
}
