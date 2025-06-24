import { NestFactory } from '@nestjs/core';
import {
  ValidationPipe,
  Logger,
  HttpException,
  HttpStatus,
  LogLevel,
} from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpAdapterHost } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import {
  AllExceptionsFilter,
  HttpExceptionFilter,
  ValidationExceptionFilter,
  RpcExceptionFilter,
} from './common/filters';

// Configuration constants
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

interface AppConfig {
  environment: 'local' | 'develop' | 'staging' | 'production';
  port: number;
  frontendUrl?: string;
  allowedOriginPrefix?: string;
  loggerLevels: LogLevel[];
}

function createAppConfig(): AppConfig {
  const environment = process.env.ENVIRONMENT || 'local';
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULT_PORT;
  const frontendUrl = process.env.FRONTEND_URL;
  const allowedOriginPrefix = process.env.ALLOWED_ORIGIN_PREFIX;

  // Parse logger levels from environment variable
  const loggerLevelsEnv = process.env.LOGGER_LEVELS;
  let loggerLevels: LogLevel[] = DEFAULT_LOGGER_LEVELS;

  if (loggerLevelsEnv) {
    const parsedLevels = loggerLevelsEnv
      .split(',')
      .map((level) => level.trim());
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

    loggerLevels = parsedLevels as LogLevel[];
  }

  // Validate environment
  if (!['local', 'develop', 'staging', 'production'].includes(environment)) {
    throw new Error(
      `Invalid ENVIRONMENT: ${environment}. Must be 'local', 'develop', 'staging', or 'production'.`,
    );
  }

  // Validate port
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid PORT: ${process.env.PORT}. Must be a number between 1 and 65535.`,
    );
  }

  return {
    environment: environment as AppConfig['environment'],
    port,
    frontendUrl,
    allowedOriginPrefix,
    loggerLevels,
  };
}

function setupGlobalExceptionHandlers(logger: Logger): void {
  process.on('unhandledRejection', (reason) => {
    logger.error(
      `Unhandled Promise Rejection: ${reason instanceof Error ? reason.message : String(reason)}`,
      reason instanceof Error ? reason.stack : undefined,
    );
  });

  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error.message}`, error.stack);
  });
}

function createCorsConfig(config: AppConfig) {
  return {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (shouldAllowOrigin(origin, config)) {
        callback(null, true);
        return;
      }

      callback(new HttpException('Not allowed by CORS', HttpStatus.FORBIDDEN));
    },
    methods: ALLOWED_HTTP_METHODS,
    credentials: true,
  };
}

function shouldAllowOrigin(
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

async function createNestApp(config: AppConfig): Promise<INestApplication> {
  return await NestFactory.create(AppModule, {
    cors: createCorsConfig(config),
    logger: config.loggerLevels,
  });
}

function setupAppMiddleware(app: INestApplication): void {
  // Apply validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );

  // Apply exception filters in order from most specific to most general
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(
    new ValidationExceptionFilter(),
    new RpcExceptionFilter(),
    new HttpExceptionFilter(),
    new AllExceptionsFilter(httpAdapterHost),
  );
}

async function startServer(
  app: INestApplication,
  config: AppConfig,
  logger: Logger,
): Promise<void> {
  await app.listen(config.port, '::');
  logger.log(`Application is running on: ${await app.getUrl()}`);
  logger.log(`Environment: ${config.environment}`);
  if (config.frontendUrl) {
    logger.log(`Frontend URL: ${config.frontendUrl}`);
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const config = createAppConfig();
    logger.log(
      `Configuration loaded successfully for environment: ${config.environment}`,
    );

    setupGlobalExceptionHandlers(logger);
    const app = await createNestApp(config);
    setupAppMiddleware(app);
    await startServer(app, config, logger);
  } catch (error) {
    logger.error(
      'Failed to load configuration',
      error instanceof Error ? error.stack : error,
    );
    throw error;
  }
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
