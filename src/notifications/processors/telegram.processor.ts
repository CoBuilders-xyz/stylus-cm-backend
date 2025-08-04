import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from 'src/alerts/entities/alert.entity';
import { TelegramNotificationService } from '../services/telegram.service';
import { BaseProcessorData } from '../interfaces';
import { createContextLogger } from 'src/common/utils/logger.util';
import { TimingService } from '../services/timing.service';

@Processor('notif-telegram')
export class TelegramNotificationProcessor extends WorkerHost {
  private readonly logger = createContextLogger(
    'TelegramProcessor',
    'Notifications',
  );

  constructor(
    private readonly telegramService: TelegramNotificationService,
    @InjectRepository(Alert)
    private alertsRepository: Repository<Alert>,
    private readonly timingService: TimingService,
  ) {
    super();
  }

  async process(job: Job<BaseProcessorData, any, string>): Promise<void> {
    const { alertId, destination, userId } = job.data;

    this.logger.log(
      `Processing Telegram notification job for alert: ${alertId}`,
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
        `Processing Telegram notification for alert type: ${alert.type}`,
      );

      await this.telegramService.sendNotification({
        destination,
        alertType: alert.type,
        value: alert.value,
        contractName: alert.userContract?.name || 'Unknown Contract',
        contractAddress: alert.userContract?.address || 'Unknown Address',
      });

      // Update lastNotified timestamp
      const updatedAlert = this.timingService.updateLastNotified(alert);
      await this.alertsRepository.save(updatedAlert);

      this.logger.log(
        `Successfully sent Telegram notification for alert: ${alertId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing Telegram notification for alert: ${alertId}`,
        error,
      );
      throw error;
    }
  }
}
