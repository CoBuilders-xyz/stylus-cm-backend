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
const LOGGER_LEVELS: LogLevel[] = ['error', 'debug', 'warn', 'log'];
const ALLOWED_HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
];

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

function createCorsConfig() {
  return {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (shouldAllowOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new HttpException('Not allowed by CORS', HttpStatus.FORBIDDEN));
    },
    methods: ALLOWED_HTTP_METHODS,
    credentials: true,
  };
}

function shouldAllowOrigin(origin: string | undefined): boolean {
  // Allow requests with no origin (like Postman, curl, etc.) for development
  if (!origin && process.env.ENVIRONMENT === 'local') {
    return true;
  }

  // Allow origins that start with https://stylus-cm-frontend in non-production
  if (
    process.env.ENVIRONMENT !== 'production' &&
    origin?.startsWith('https://stylus-cm-frontend')
  ) {
    return true;
  }

  // Allow the main frontend URL if specified in env
  if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
    return true;
  }

  return false;
}

async function createNestApp(): Promise<INestApplication> {
  return await NestFactory.create(AppModule, {
    cors: createCorsConfig(),
    logger: LOGGER_LEVELS,
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
  logger: Logger,
): Promise<void> {
  const port = process.env.PORT ?? DEFAULT_PORT;
  await app.listen(port, '::');
  logger.log(`Application is running on: ${await app.getUrl()}`);
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  setupGlobalExceptionHandlers(logger);
  const app = await createNestApp();
  setupAppMiddleware(app);
  await startServer(app, logger);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
