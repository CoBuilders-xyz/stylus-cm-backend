import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface RpcError {
  code: number | string;
  error?: {
    code: number;
    message: string;
  };
  message?: string;
  payload?: unknown;
  shortMessage?: string;
}

/**
 * Filter for handling RPC errors from ethers.js
 */
@Catch(Error)
export class RpcExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(RpcExceptionFilter.name);

  catch(exception: Error & RpcError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Check if this is an RPC error from ethers.js
    const isRpcError =
      exception.code !== undefined &&
      (exception.error !== undefined || exception.shortMessage !== undefined);

    if (!isRpcError) {
      // Let other filters handle non-RPC errors
      throw exception;
    }

    const rpcErrorCode = exception.error?.code || 500;

    // Map RPC error codes to HTTP status codes
    let httpStatus: number;
    switch (rpcErrorCode) {
      case 429:
        httpStatus = HttpStatus.TOO_MANY_REQUESTS;
        break;
      case -32603: // Internal JSON-RPC error
        httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
        break;
      case -32602: // Invalid params
        httpStatus = HttpStatus.BAD_REQUEST;
        break;
      case -32601: // Method not found
        httpStatus = HttpStatus.NOT_FOUND;
        break;
      default:
        httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    }

    const errorMessage =
      exception.error?.message ||
      exception.message ||
      exception.shortMessage ||
      'RPC Error';

    const errorResponse = {
      statusCode: httpStatus,
      rpcCode: exception.error?.code || exception.code,
      timestamp: new Date().toISOString(),
      message: errorMessage,
      path: request.url || 'unknown',
    };

    // Log the error with detailed information
    this.logger.error(`RPC Exception: ${errorMessage}`, {
      error: exception.error,
      code: exception.code,
      payload: exception.payload,
      stack: exception.stack,
    });

    response.status(httpStatus).json(errorResponse);
  }
}
