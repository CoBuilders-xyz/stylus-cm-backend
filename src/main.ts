import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpAdapterHost } from '@nestjs/core';
import {
  AllExceptionsFilter,
  HttpExceptionFilter,
  ValidationExceptionFilter,
  RpcExceptionFilter,
} from './common/filters';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Global unhandled exception handlers
  process.on('unhandledRejection', (reason) => {
    logger.error(
      `Unhandled Promise Rejection: ${reason instanceof Error ? reason.message : String(reason)}`,
      reason instanceof Error ? reason.stack : undefined,
    );
  });

  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error.message}`, error.stack);
  });

  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: (origin, callback) => {
        // Allow origins that start with https://stylus-cm-frontend
        if (origin?.startsWith('https://stylus-cm-frontend')) {
          callback(null, true);
          return;
        }

        // Allow the main frontend URL if specified in env
        if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
          callback(null, true);
          return;
        }

        callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      credentials: true,
    },
    logger: ['error', 'debug', 'warn', 'log'],
  });

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

  await app.listen(process.env.PORT ?? 3000, '::');
  logger.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
