import { NestFactory } from '@nestjs/core';
import { Logger, HttpException, HttpStatus } from '@nestjs/common';
import { AppModule } from './app.module';
import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { SwaggerTheme, SwaggerThemeNameEnum } from 'swagger-themes';
import { setupAppMiddleware } from './app.setup';
import appConfig, {
  AppConfig,
  shouldAllowOrigin,
} from './common/config/app.config';
import {
  sanitizeForLog,
  sanitizeStackForLog,
} from './common/utils/log-sanitizer.util';
import { installLogSanitizer } from './common/utils/log-sanitizer-install.util';

// Patch Nest's ConsoleLogger once, before the first log line, so every line
// of the process is sanitized right before it is written.
installLogSanitizer();

function setupGlobalExceptionHandlers(logger: Logger): void {
  process.on('unhandledRejection', (reason) => {
    logger.error(
      `Unhandled Promise Rejection: ${sanitizeForLog(reason)}`,
      sanitizeStackForLog(reason),
    );
  });

  process.on('uncaughtException', (error) => {
    logger.error(
      `Uncaught Exception: ${sanitizeForLog(error)}`,
      sanitizeStackForLog(error),
    );
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Stylus Manager')
    .setDescription(
      'REST API for **Stylus Manager** — an Arbitrum Stylus contract lifecycle platform ' +
        'covering WASM program caching, activation, and automation.\n\n' +
        '**Quick start:** Use `POST /auth/test-login` with a funded wallet to get a JWT, ' +
        'then click **Authorize** and paste the token.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .setContact('CoBuilders', 'https://cobuilders.xyz', '')
    .setExternalDoc(
      'Documentation',
      'https://cobuilders-xyz.github.io/stylus-cm-deploy',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  const theme = new SwaggerTheme();
  SwaggerModule.setup('api', app, document, {
    customSiteTitle: 'Stylus Manager — API',
    customCss: theme.getBuffer(SwaggerThemeNameEnum.DARK),
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      displayRequestDuration: true,
      tryItOutEnabled: true,
    },
  });

  await startServer(app, config, logger);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error(
    `Failed to start application: ${sanitizeForLog(error)}`,
    sanitizeStackForLog(error),
  );
  process.exit(1);
});
