import { registerAs } from '@nestjs/config';
import { CronExpression } from '@nestjs/schedule';

export interface StateFetcherConfig {
  pollingInterval: string;
  contractTimeout: number;
  maxRetryAttempts: number;
  retryDelay: number;
  enableMetrics: boolean;
  enableInitialPolling: boolean;
}

export default registerAs('state-fetcher', (): StateFetcherConfig => {
  // Validate cron expression format
  const validateCronExpression = (cronExpression: string): string => {
    const validExpressions = [
      CronExpression.EVERY_MINUTE,
      CronExpression.EVERY_5_MINUTES,
      CronExpression.EVERY_10_MINUTES,
      CronExpression.EVERY_30_MINUTES,
      CronExpression.EVERY_HOUR,
    ];

    if (!validExpressions.includes(cronExpression as any)) {
      // Basic validation - check if it's a valid cron pattern
      const cronPattern =
        /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/;

      if (!cronPattern.test(cronExpression)) {
        throw new Error(
          `Invalid STATE_FETCHER_POLLING_INTERVAL: ${cronExpression}. Must be a valid cron expression.`,
        );
      }
    }

    return cronExpression;
  };

  // Validate timeout value
  const validateTimeout = (value: string): number => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1000 || num > 300000) {
      throw new Error(
        `Invalid STATE_FETCHER_CONTRACT_TIMEOUT: ${value}. Must be between 1000ms (1s) and 300000ms (5m)`,
      );
    }
    return num;
  };

  // Validate retry attempts
  const validateRetryAttempts = (value: string): number => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0 || num > 10) {
      throw new Error(
        `Invalid STATE_FETCHER_MAX_RETRY_ATTEMPTS: ${value}. Must be between 0 and 10`,
      );
    }
    return num;
  };

  // Validate retry delay
  const validateRetryDelay = (value: string): number => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 100 || num > 60000) {
      throw new Error(
        `Invalid STATE_FETCHER_RETRY_DELAY: ${value}. Must be between 100ms and 60000ms (1m)`,
      );
    }
    return num;
  };

  // Get configuration values with defaults and validation
  const pollingInterval = validateCronExpression(
    process.env.STATE_FETCHER_POLLING_INTERVAL ||
      CronExpression.EVERY_5_MINUTES,
  );

  const contractTimeout = validateTimeout(
    process.env.STATE_FETCHER_CONTRACT_TIMEOUT || '30000',
  );

  const maxRetryAttempts = validateRetryAttempts(
    process.env.STATE_FETCHER_MAX_RETRY_ATTEMPTS || '3',
  );

  const retryDelay = validateRetryDelay(
    process.env.STATE_FETCHER_RETRY_DELAY || '1000',
  );

  const enableMetrics =
    process.env.STATE_FETCHER_ENABLE_METRICS === 'true' || true;
  const enableInitialPolling =
    process.env.STATE_FETCHER_ENABLE_INITIAL_POLLING !== 'false';

  return {
    pollingInterval,
    contractTimeout,
    maxRetryAttempts,
    retryDelay,
    enableMetrics,
    enableInitialPolling,
  };
});
