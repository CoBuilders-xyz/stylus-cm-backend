import { registerAs } from '@nestjs/config';

export interface CmaConfig {
  batchSize: number;
  paginationLimit: number;
  maxRetries: number;
  retryDelay: number;
  processingTimeout: number;
  automationEnabled: boolean;
}

export default registerAs('cma', (): CmaConfig => {
  // Validate batch size
  const validateBatchSize = (value: string): number => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1 || num > 100) {
      throw new Error(
        `Invalid CMA_BATCH_SIZE: ${value}. Must be between 1 and 100`,
      );
    }
    return num;
  };

  // Validate pagination limit
  const validatePaginationLimit = (value: string): number => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1 || num > 100) {
      throw new Error(
        `Invalid CMA_PAGINATION_LIMIT: ${value}. Must be between 1 and 100`,
      );
    }
    return num;
  };

  // Validate max retries
  const validateMaxRetries = (value: string): number => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0 || num > 10) {
      throw new Error(
        `Invalid CMA_MAX_RETRIES: ${value}. Must be between 0 and 10`,
      );
    }
    return num;
  };

  // Validate retry delay
  const validateRetryDelay = (value: string): number => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 100 || num > 60000) {
      throw new Error(
        `Invalid CMA_RETRY_DELAY: ${value}. Must be between 100ms and 60000ms`,
      );
    }
    return num;
  };

  // Validate processing timeout
  const validateProcessingTimeout = (value: string): number => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 5000 || num > 300000) {
      throw new Error(
        `Invalid CMA_PROCESSING_TIMEOUT: ${value}. Must be between 5000ms (5s) and 300000ms (5m)`,
      );
    }
    return num;
  };

  // Validate automation enabled
  const validateAutomationEnabled = (value: string): boolean => {
    const lowerValue = value.toLowerCase();
    if (!['true', 'false'].includes(lowerValue)) {
      throw new Error(
        `Invalid CMA_AUTOMATION_ENABLED: ${value}. Must be 'true' or 'false'`,
      );
    }
    return lowerValue === 'true';
  };

  // Get configuration values with defaults and validation
  const batchSize = validateBatchSize(process.env.CMA_BATCH_SIZE || '50');
  const paginationLimit = validatePaginationLimit(
    process.env.CMA_PAGINATION_LIMIT || '30',
  );
  const maxRetries = validateMaxRetries(process.env.CMA_MAX_RETRIES || '3');
  const retryDelay = validateRetryDelay(process.env.CMA_RETRY_DELAY || '1000');
  const processingTimeout = validateProcessingTimeout(
    process.env.CMA_PROCESSING_TIMEOUT || '30000',
  );
  const automationEnabled = validateAutomationEnabled(
    process.env.CMA_AUTOMATION_ENABLED || 'true',
  );

  return {
    batchSize,
    paginationLimit,
    maxRetries,
    retryDelay,
    processingTimeout,
    automationEnabled,
  };
});
