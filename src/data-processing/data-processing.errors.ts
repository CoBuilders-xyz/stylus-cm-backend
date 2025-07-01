import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';

export enum DataProcessingErrorCode {
  EVENT_PROCESSING_FAILED = 'EVENT_PROCESSING_FAILED',
  INVALID_EVENT_DATA = 'INVALID_EVENT_DATA',
  BLOCKCHAIN_NOT_FOUND = 'BLOCKCHAIN_NOT_FOUND',
  EVENT_NOT_FOUND = 'EVENT_NOT_FOUND',
  BID_CALCULATION_FAILED = 'BID_CALCULATION_FAILED',
  DATABASE_OPERATION_FAILED = 'DATABASE_OPERATION_FAILED',
  INVALID_EVENT_TYPE = 'INVALID_EVENT_TYPE',
}

export const DataProcessingErrors = {
  EVENT_PROCESSING_FAILED: {
    error: DataProcessingErrorCode.EVENT_PROCESSING_FAILED,
    message: 'Failed to process blockchain event',
  },
  INVALID_EVENT_DATA: {
    error: DataProcessingErrorCode.INVALID_EVENT_DATA,
    message: 'Event data is not in the expected format',
  },
  BLOCKCHAIN_NOT_FOUND: {
    error: DataProcessingErrorCode.BLOCKCHAIN_NOT_FOUND,
    message: 'Blockchain not found with the provided ID',
  },
  EVENT_NOT_FOUND: {
    error: DataProcessingErrorCode.EVENT_NOT_FOUND,
    message: 'Event not found with the provided ID',
  },
  BID_CALCULATION_FAILED: {
    error: DataProcessingErrorCode.BID_CALCULATION_FAILED,
    message: 'Failed to calculate bid value',
  },
  DATABASE_OPERATION_FAILED: {
    error: DataProcessingErrorCode.DATABASE_OPERATION_FAILED,
    message: 'Database operation failed',
  },
  INVALID_EVENT_TYPE: {
    error: DataProcessingErrorCode.INVALID_EVENT_TYPE,
    message: 'Invalid or unsupported event type',
  },
} as const;

/**
 * Helper functions to throw specific data processing errors
 */
export const throwDataProcessingError = (
  errorType: keyof typeof DataProcessingErrors,
): never => {
  throw new InternalServerErrorException(DataProcessingErrors[errorType]);
};

export const throwDataProcessingNotFoundError = (
  errorType: keyof typeof DataProcessingErrors,
): never => {
  throw new NotFoundException(DataProcessingErrors[errorType]);
};

export const throwDataProcessingBadRequestError = (
  errorType: keyof typeof DataProcessingErrors,
): never => {
  throw new BadRequestException(DataProcessingErrors[errorType]);
};

/**
 * Specific error thrower functions for better developer experience
 */
export const DataProcessingErrorHelpers = {
  throwEventProcessingFailed: (eventId: string, eventType: string) => {
    const message = `Failed to process ${eventType} event: ${eventId}`;
    throw new InternalServerErrorException({
      error: DataProcessingErrorCode.EVENT_PROCESSING_FAILED,
      message,
    });
  },
  throwInvalidEventData: (
    eventId: string,
    eventType: string,
    data: unknown,
  ) => {
    const message = `Invalid event data for ${eventType} event: ${eventId}. Data: ${JSON.stringify(data)}`;
    throw new BadRequestException({
      error: DataProcessingErrorCode.INVALID_EVENT_DATA,
      message,
    });
  },
  throwBlockchainNotFound: () => {
    throwDataProcessingNotFoundError('BLOCKCHAIN_NOT_FOUND');
  },
  throwEventNotFound: () => {
    throwDataProcessingNotFoundError('EVENT_NOT_FOUND');
  },
  throwBidCalculationFailed: (bidValue: string, decayRate: string) => {
    const message = `Failed to calculate bid for value: ${bidValue}, decay rate: ${decayRate}`;
    throw new InternalServerErrorException({
      error: DataProcessingErrorCode.BID_CALCULATION_FAILED,
      message,
    });
  },
  throwDatabaseOperationFailed: (operation: string) => {
    const message = `Database operation failed: ${operation}`;
    throw new InternalServerErrorException({
      error: DataProcessingErrorCode.DATABASE_OPERATION_FAILED,
      message,
    });
  },
  throwInvalidEventType: () => {
    throwDataProcessingBadRequestError('INVALID_EVENT_TYPE');
  },
};
