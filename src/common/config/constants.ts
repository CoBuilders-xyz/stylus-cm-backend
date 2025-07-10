import { LogLevel } from '@nestjs/common';

// App configuration constants
export const DEFAULT_PORT = 3000;
export const DEFAULT_LOGGER_LEVELS: LogLevel[] = ['log', 'error'];
export const ALLOWED_HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
];

export const VALID_ENVIRONMENTS = ['local', 'develop', 'staging', 'production'];
export const VALID_LOGGER_LEVELS: LogLevel[] = [
  'error',
  'warn',
  'log',
  'debug',
  'verbose',
];

// Database configuration constants
export const DEFAULT_POSTGRES_PORT = 5432;

// Redis configuration constants
export const DEFAULT_REDIS_PORT = 6380;
export const DEFAULT_REDIS_FAMILY = 0;
export const DEFAULT_BULLMQ_ATTEMPTS = 5;
export const DEFAULT_BULLMQ_BACKOFF_DELAY = 10000;
export const MIN_BULLMQ_BACKOFF_DELAY = 1000;
