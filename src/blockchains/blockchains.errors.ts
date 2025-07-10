import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

/**
 * Error codes for the Blockchains module
 */
export enum BlockchainsErrorCode {
  BLOCKCHAIN_NOT_FOUND = 'BLOCKCHAIN_NOT_FOUND',
  BLOCKCHAIN_STATE_NOT_FOUND = 'BLOCKCHAIN_STATE_NOT_FOUND',
  INVALID_TIMESPAN = 'INVALID_TIMESPAN',
  INVALID_SIZE_RANGE = 'INVALID_SIZE_RANGE',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  ANALYTICS_CALCULATION_ERROR = 'ANALYTICS_CALCULATION_ERROR',
}

/**
 * Error definitions with structured error messages
 */
export const BlockchainsErrors = {
  BLOCKCHAIN_NOT_FOUND: {
    error: BlockchainsErrorCode.BLOCKCHAIN_NOT_FOUND,
    message: 'Blockchain not found with the provided ID',
  },
  BLOCKCHAIN_STATE_NOT_FOUND: {
    error: BlockchainsErrorCode.BLOCKCHAIN_STATE_NOT_FOUND,
    message: 'Blockchain state not found for the specified blockchain',
  },
  INVALID_TIMESPAN: {
    error: BlockchainsErrorCode.INVALID_TIMESPAN,
    message: 'Invalid timespan provided. Must be one of: D, W, M, Y',
  },
  INVALID_SIZE_RANGE: {
    error: BlockchainsErrorCode.INVALID_SIZE_RANGE,
    message: 'Invalid size range provided. Min size must be less than max size',
  },
  CONFIGURATION_ERROR: {
    error: BlockchainsErrorCode.CONFIGURATION_ERROR,
    message: 'Error in blockchain configuration initialization',
  },
  INSUFFICIENT_DATA: {
    error: BlockchainsErrorCode.INSUFFICIENT_DATA,
    message: 'Insufficient data available to perform the requested operation',
  },
  ANALYTICS_CALCULATION_ERROR: {
    error: BlockchainsErrorCode.ANALYTICS_CALCULATION_ERROR,
    message: 'Error occurred while calculating analytics data',
  },
} as const;

/**
 * Helper functions for throwing specific blockchain errors
 */
export const BlockchainsErrorHelpers = {
  throwBlockchainNotFound: (blockchainId?: string) => {
    const message = blockchainId
      ? `Blockchain not found with ID: ${blockchainId}`
      : BlockchainsErrors.BLOCKCHAIN_NOT_FOUND.message;
    throw new NotFoundException({
      ...BlockchainsErrors.BLOCKCHAIN_NOT_FOUND,
      message,
    });
  },

  throwBlockchainStateNotFound: (blockchainId?: string) => {
    const message = blockchainId
      ? `Blockchain state not found for blockchain ID: ${blockchainId}`
      : BlockchainsErrors.BLOCKCHAIN_STATE_NOT_FOUND.message;
    throw new NotFoundException({
      ...BlockchainsErrors.BLOCKCHAIN_STATE_NOT_FOUND,
      message,
    });
  },

  throwInvalidTimespan: (providedTimespan?: string) => {
    const message = providedTimespan
      ? `Invalid timespan '${providedTimespan}'. Must be one of: D, W, M, Y`
      : BlockchainsErrors.INVALID_TIMESPAN.message;
    throw new BadRequestException({
      ...BlockchainsErrors.INVALID_TIMESPAN,
      message,
    });
  },

  throwInvalidSizeRange: (minSize?: number, maxSize?: number) => {
    const baseError = BlockchainsErrors.INVALID_SIZE_RANGE;
    const message =
      minSize !== undefined && maxSize !== undefined
        ? `Invalid size range: minSize (${minSize}) must be less than maxSize (${maxSize})`
        : baseError.message;
    throw new BadRequestException({
      error: baseError.error,
      message,
    });
  },

  throwConfigurationError: (details?: string) => {
    const message = details
      ? `${BlockchainsErrors.CONFIGURATION_ERROR.message}: ${details}`
      : BlockchainsErrors.CONFIGURATION_ERROR.message;
    throw new InternalServerErrorException({
      ...BlockchainsErrors.CONFIGURATION_ERROR,
      message,
    });
  },

  throwInsufficientData: (operation?: string) => {
    const message = operation
      ? `Insufficient data available for ${operation}`
      : BlockchainsErrors.INSUFFICIENT_DATA.message;
    throw new BadRequestException({
      ...BlockchainsErrors.INSUFFICIENT_DATA,
      message,
    });
  },

  throwAnalyticsCalculationError: (details?: string) => {
    const message = details
      ? `${BlockchainsErrors.ANALYTICS_CALCULATION_ERROR.message}: ${details}`
      : BlockchainsErrors.ANALYTICS_CALCULATION_ERROR.message;
    throw new InternalServerErrorException({
      ...BlockchainsErrors.ANALYTICS_CALCULATION_ERROR,
      message,
    });
  },
};
