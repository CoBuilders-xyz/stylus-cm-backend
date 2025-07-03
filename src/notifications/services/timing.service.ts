import { Injectable } from '@nestjs/common';
import { Alert } from 'src/alerts/entities/alert.entity';
import { createModuleLogger } from 'src/common/utils/logger.util';

@Injectable()
export class TimingService {
  private readonly logger = createModuleLogger(TimingService, 'Notifications');

  /**
   * Check if the backoff delay has been exceeded since the last notification
   */
  isBackoffDelayExceeded(alert: Alert): boolean {
    if (!alert.lastNotified) {
      this.logger.debug(
        `No previous notification for alert: ${alert.id} - allowing notification`,
      );
      return true; // No previous notification, so delay is exceeded
    }

    const backoffDelay = process.env.BACKOFF_DELAY;
    const lastNotified = new Date(alert.lastNotified);
    const now = new Date();
    const timeDiff = now.getTime() - lastNotified.getTime();

    const delayExceeded = timeDiff >= Number(backoffDelay);

    if (!delayExceeded) {
      this.logger.log(
        `Backoff delay not exceeded for alert: ${alert.id} - skipping notifications`,
      );
      this.logger.debug(
        `Time since last notification: ${timeDiff}ms, required delay: ${backoffDelay}ms`,
      );
    } else {
      this.logger.debug(
        `Backoff delay exceeded for alert: ${alert.id} - allowing notification`,
      );
    }

    return delayExceeded;
  }

  /**
   * Update the lastNotified timestamp for an alert
   */
  updateLastNotified(alert: Alert): Alert {
    this.logger.debug(`Updating lastNotified timestamp for alert: ${alert.id}`);
    alert.lastNotified = new Date();
    return alert;
  }
}
