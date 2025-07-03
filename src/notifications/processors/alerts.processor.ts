import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotificationsService } from '../notifications.service';
import { Alert } from 'src/alerts/entities/alert.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { createContextLogger } from 'src/common/utils/logger.util';

@Processor('alerts')
export class AlertsConsumer extends WorkerHost {
  private readonly logger = createContextLogger(
    'AlertsConsumer',
    'Notifications',
  );

  constructor(
    private readonly notificationsService: NotificationsService,
    @InjectRepository(Alert)
    private readonly alertsRepository: Repository<Alert>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super();
  }

  async process(job: Job<{ alertId: string }, void, string>): Promise<void> {
    const { alertId } = job.data;

    this.logger.log(`Processing alert job for alert: ${alertId}`);
    this.logger.debug(`Job details: alertId=${alertId}`);

    try {
      const alert = await this.alertsRepository.findOne({
        where: { id: alertId },
        relations: ['user'],
      });

      if (!alert) {
        this.logger.log(`Alert not found: ${alertId} - skipping processing`);
        return;
      }

      const user = await this.userRepository.findOne({
        where: { id: alert.user.id },
      });

      if (!user) {
        this.logger.log(
          `User not found for alert: ${alertId} - skipping processing`,
        );
        return;
      }

      this.logger.debug(
        `Processing alert of type: ${alert.type} for user: ${user.id}`,
      );

      await this.notificationsService.sendNotifications(
        alert,
        user.alertsSettings,
      );

      // Update the alert's last triggered timestamp and count
      alert.lastTriggered = new Date();
      alert.triggeredCount += 1;
      await this.alertsRepository.save(alert);

      this.logger.log(
        `Successfully processed alert: ${alertId}, triggered count: ${alert.triggeredCount}`,
      );
    } catch (error) {
      this.logger.error(`Error processing alert: ${alertId}`, error);
      throw error;
    }
  }
}
