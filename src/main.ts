import { NestFactory } from '@nestjs/core';
import {
  ValidationPipe,
  Logger,
  HttpException,
  HttpStatus,
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
import appConfig, {
  AppConfig,
  shouldAllowOrigin,
} from './common/config/app.config';

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
    methods: config.cors.allowedHttpMethods,
    credentials: true,
  };
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

  // Load configuration directly from config file (no NestJS app needed)
  const config = appConfig();

  logger.log(
    `Configuration loaded successfully for environment: ${config.environment}`,
  );

  // Create app once with proper configuration
  const app = await createNestApp(config);

  setupGlobalExceptionHandlers(logger);
  setupAppMiddleware(app);
  await startServer(app, config, logger);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  logger.error(`Failed to start application: ${message}`, stack);
  process.exit(1);
});
