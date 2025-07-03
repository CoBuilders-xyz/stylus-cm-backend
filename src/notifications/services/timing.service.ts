import { Injectable, Logger } from '@nestjs/common';
import { Alert } from 'src/alerts/entities/alert.entity';

@Injectable()
export class TimingService {
  private readonly logger = new Logger(TimingService.name);

  /**
   * Check if the backoff delay has been exceeded since the last notification
   */
  isBackoffDelayExceeded(alert: Alert): boolean {
    if (!alert.lastNotified) {
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
    }

    return delayExceeded;
  }

  /**
   * Update the lastNotified timestamp for an alert
   */
  updateLastNotified(alert: Alert): Alert {
    alert.lastNotified = new Date();
    return alert;
  }
}
