import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Filter specifically for handling validation exceptions
 */
@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationExceptionFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    // Extract validation errors if present
    const exceptionResponse = exception.getResponse() as
      | string
      | { message: string | string[] };

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      validation:
        typeof exceptionResponse === 'object' &&
        Array.isArray(exceptionResponse.message)
          ? exceptionResponse.message
          : [
              typeof exceptionResponse === 'string'
                ? exceptionResponse
                : exception.message,
            ],
    };

    this.logger.debug(`Validation error: ${JSON.stringify(errorResponse)}`);

    response.status(status).json(errorResponse);
  }
}
