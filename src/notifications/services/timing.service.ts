import { Injectable } from '@nestjs/common';
import { Alert } from 'src/alerts/entities/alert.entity';
import { createModuleLogger } from 'src/common/utils/logger.util';
import { MODULE_NAME } from '../constants/module.constants';

@Injectable()
export class TimingService {
  private readonly logger = createModuleLogger(TimingService, MODULE_NAME);

  /**
   * Check if the backoff delay has been exceeded since the last notification
   */
  isBackoffDelayExceeded(alert: Alert): boolean {
    if (!alert.lastQueued) {
      this.logger.debug(
        `No previous notification for alert: ${alert.id} - allowing notification`,
      );
      return true; // No previous notification, so delay is exceeded
    }

    const backoffDelay = process.env.BACKOFF_DELAY;
    const lastQueued = new Date(alert.lastQueued);
    const now = new Date();
    const timeDiff = now.getTime() - lastQueued.getTime();

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
   * Update the lastQueued timestamp for an alert
   */
  updateLastQueued(alert: Alert): Alert {
    this.logger.debug(`Updating lastQueued timestamp for alert: ${alert.id}`);
    alert.lastQueued = new Date();
    return alert;
  }

  updateLastNotified(alert: Alert): Alert {
    this.logger.debug(`Updating lastNotified timestamp for alert: ${alert.id}`);
    alert.lastNotified = new Date();
    return alert;
  }
}
