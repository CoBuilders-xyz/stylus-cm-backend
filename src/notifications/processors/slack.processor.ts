import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from 'src/alerts/entities/alert.entity';
import { SlackNotificationService } from '../services/slack.service';
import { SlackNotificationData } from '../interfaces';
import { createContextLogger } from 'src/common/utils/logger.util';

@Processor('notif-slack')
export class SlackNotificationProcessor extends WorkerHost {
  private readonly logger = createContextLogger(
    'SlackProcessor',
    'Notifications',
  );

  constructor(
    private readonly slackService: SlackNotificationService,
    @InjectRepository(Alert)
    private alertsRepository: Repository<Alert>,
  ) {
    super();
  }

  async process(job: Job<SlackNotificationData, any, string>): Promise<void> {
    const { alertId, destination, userId } = job.data;

    this.logger.log(`Processing Slack notification job for alert: ${alertId}`);
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
        `Processing Slack notification for alert type: ${alert.type}`,
      );

      await this.slackService.sendNotification({
        destination,
        alertType: alert.type,
        value: alert.value,
        contractName: alert.userContract?.name || 'Unknown Contract',
        contractAddress: alert.userContract?.address || 'Unknown Address',
      });

      this.logger.log(
        `Successfully sent Slack notification for alert: ${alertId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing Slack notification for alert: ${alertId}`,
        error,
      );
      throw error;
    }
  }
}
