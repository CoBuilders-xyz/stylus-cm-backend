import { registerAs } from '@nestjs/config';
import { LogLevel } from '@nestjs/common';
import { validatePort } from '../utils/validation.util';

export interface AppConfig {
  cors: {
    allowedHttpMethods: string[];
  };
  environment: 'local' | 'develop' | 'staging' | 'production';
  loggerLevels: LogLevel[];
  port: number;
  allowedOriginPrefix?: string;
  frontendUrl?: string;
}

const DEFAULT_PORT = 3000;
const DEFAULT_LOGGER_LEVELS: LogLevel[] = ['log', 'error'];
const ALLOWED_HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
];

export default registerAs('app', (): AppConfig => {
  // Validate environment
  const validateEnvironment = (env: string): AppConfig['environment'] => {
    const validEnvironments = ['local', 'develop', 'staging', 'production'];
    if (!validEnvironments.includes(env)) {
      throw new Error(
        `Invalid ENVIRONMENT: ${env}. Must be one of: ${validEnvironments.join(', ')}.`,
      );
    }
    return env as AppConfig['environment'];
  };

  // Validate logger levels
  const validateLoggerLevels = (levelsString: string): LogLevel[] => {
    const parsedLevels = levelsString.split(',').map((level) => level.trim());
    const validLevels: LogLevel[] = [
      'error',
      'warn',
      'log',
      'debug',
      'verbose',
    ];

    // Validate all levels are valid
    for (const level of parsedLevels) {
      if (!validLevels.includes(level as LogLevel)) {
        throw new Error(
          `Invalid LOGGER_LEVELS: '${level}'. Valid levels are: ${validLevels.join(', ')}`,
        );
      }
    }

    return parsedLevels as LogLevel[];
  };

  // Get and validate configuration values
  const environment = validateEnvironment(process.env.ENVIRONMENT || 'local');
  const port = process.env.PORT
    ? validatePort(process.env.PORT, 'PORT')
    : DEFAULT_PORT;
  const frontendUrl = process.env.FRONTEND_URL;
  const allowedOriginPrefix = process.env.ALLOWED_ORIGIN_PREFIX;

  // Parse logger levels from environment variable
  const loggerLevels = process.env.LOGGER_LEVELS
    ? validateLoggerLevels(process.env.LOGGER_LEVELS)
    : DEFAULT_LOGGER_LEVELS;

  return {
    environment,
    port,
    frontendUrl,
    allowedOriginPrefix,
    loggerLevels,
    cors: {
      allowedHttpMethods: ALLOWED_HTTP_METHODS,
    },
  };
});

// Helper function for CORS origin validation (exported for use in main.ts)
export function shouldAllowOrigin(
  origin: string | undefined,
  config: AppConfig,
): boolean {
  // Allow requests with no origin (like Postman, curl, etc.) for development
  if (!origin && config.environment === 'local') {
    return true;
  }

  // Allow origins that start with the configured prefix in non-production
  if (
    config.environment !== 'production' &&
    config.allowedOriginPrefix &&
    origin?.startsWith(config.allowedOriginPrefix)
  ) {
    return true;
  }

  // Allow the main frontend URL if specified in config
  if (config.frontendUrl && origin === config.frontendUrl) {
    return true;
  }

  return false;
}
