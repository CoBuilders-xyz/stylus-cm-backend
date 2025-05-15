import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request } from 'express';

/**
 * Global exception filter that catches all unhandled exceptions
 * and formats them consistently for API responses
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    // In certain situations like when HTTP server is still starting,
    // the HttpAdapter might not be available yet
    const { httpAdapter } = this.httpAdapterHost;

    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();

    // Handle HTTP exceptions differently from other exceptions
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Get the message from the exception
    const message = this.extractMessage(exception);

    // Log the exception with stack trace for non-HTTP exceptions
    if (!(exception instanceof HttpException)) {
      this.logger.error(
        `Unhandled exception: ${
          exception instanceof Error ? exception.message : 'Unknown error'
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const responseBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url || 'unknown',
      message,
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, status);
  }

  private extractMessage(exception: unknown): string | Record<string, unknown> {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      return typeof response === 'string'
        ? response
        : (response as Record<string, unknown>);
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'Internal server error';
  }
}
