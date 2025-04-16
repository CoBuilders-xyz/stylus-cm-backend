import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotificationsService } from './notifications.service';
import { Alert } from 'src/alerts/entities/alert.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Logger } from '@nestjs/common';

@Processor('alerts')
export class AlertsConsumer extends WorkerHost {
  private readonly logger = new Logger(AlertsConsumer.name);

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
    // Get the alert with related user
    const alert = await this.alertsRepository.findOne({
      where: { id: job.data.alertId },
      relations: ['user'],
    });

    if (!alert) {
      throw new Error('Alert not found');
    }

    // Load the user with all alert settings
    const user = await this.userRepository.findOne({
      where: { id: alert.user.id },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Use the notifications service to queue notifications
    await this.notificationsService.sendNotifications(
      alert,
      user.alertsSettings,
    );

    // Update the alert's last triggered timestamp and count
    alert.lastTriggered = new Date();
    alert.triggeredCount += 1;
    await this.alertsRepository.save(alert);

    await job.updateProgress(100);
  }
}
