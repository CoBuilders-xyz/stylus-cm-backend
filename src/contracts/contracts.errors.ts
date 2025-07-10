import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

export enum ContractErrorCode {
  CONTRACT_NOT_FOUND = 'CONTRACT_NOT_FOUND',
  BLOCKCHAIN_NOT_FOUND = 'BLOCKCHAIN_NOT_FOUND',
  INVALID_CONTRACT_ADDRESS = 'INVALID_CONTRACT_ADDRESS',
  INVALID_BYTECODE_SIZE = 'INVALID_BYTECODE_SIZE',
  CACHE_MANAGER_UNAVAILABLE = 'CACHE_MANAGER_UNAVAILABLE',
  BID_CALCULATION_FAILED = 'BID_CALCULATION_FAILED',
  RISK_ASSESSMENT_FAILED = 'RISK_ASSESSMENT_FAILED',
  CACHE_STATISTICS_UNAVAILABLE = 'CACHE_STATISTICS_UNAVAILABLE',
  BLOCKCHAIN_EVENT_PROCESSING_FAILED = 'BLOCKCHAIN_EVENT_PROCESSING_FAILED',
  INVALID_BLOCKCHAIN_ID = 'INVALID_BLOCKCHAIN_ID',
}

export const ContractErrors = {
  CONTRACT_NOT_FOUND: {
    error: ContractErrorCode.CONTRACT_NOT_FOUND,
    message: 'Contract not found with the provided ID',
  },
  BLOCKCHAIN_NOT_FOUND: {
    error: ContractErrorCode.BLOCKCHAIN_NOT_FOUND,
    message: 'Blockchain not found with the provided ID',
  },
  INVALID_CONTRACT_ADDRESS: {
    error: ContractErrorCode.INVALID_CONTRACT_ADDRESS,
    message: 'Invalid contract address format',
  },
  INVALID_BYTECODE_SIZE: {
    error: ContractErrorCode.INVALID_BYTECODE_SIZE,
    message: 'Invalid bytecode size. Size must be a positive number',
  },
  CACHE_MANAGER_UNAVAILABLE: {
    error: ContractErrorCode.CACHE_MANAGER_UNAVAILABLE,
    message: 'Cache manager contract is unavailable or not responding',
  },
  BID_CALCULATION_FAILED: {
    error: ContractErrorCode.BID_CALCULATION_FAILED,
    message: 'Failed to calculate bid values. Please try again later',
  },
  RISK_ASSESSMENT_FAILED: {
    error: ContractErrorCode.RISK_ASSESSMENT_FAILED,
    message: 'Failed to assess contract risk. Please try again later',
  },
  CACHE_STATISTICS_UNAVAILABLE: {
    error: ContractErrorCode.CACHE_STATISTICS_UNAVAILABLE,
    message: 'Cache statistics are currently unavailable',
  },
  BLOCKCHAIN_EVENT_PROCESSING_FAILED: {
    error: ContractErrorCode.BLOCKCHAIN_EVENT_PROCESSING_FAILED,
    message: 'Failed to process blockchain events',
  },
  INVALID_BLOCKCHAIN_ID: {
    error: ContractErrorCode.INVALID_BLOCKCHAIN_ID,
    message: 'Invalid blockchain ID format',
  },
} as const;

/**
 * Helper functions to throw specific contract errors
 */
export const throwContractNotFoundError = (
  errorType: keyof typeof ContractErrors,
): never => {
  throw new NotFoundException(ContractErrors[errorType]);
};

export const throwContractBadRequestError = (
  errorType: keyof typeof ContractErrors,
): never => {
  throw new BadRequestException(ContractErrors[errorType]);
};

export const throwContractInternalError = (
  errorType: keyof typeof ContractErrors,
): never => {
  throw new InternalServerErrorException(ContractErrors[errorType]);
};

export const throwContractServiceUnavailableError = (
  errorType: keyof typeof ContractErrors,
): never => {
  throw new ServiceUnavailableException(ContractErrors[errorType]);
};

/**
 * Specific error thrower functions for better developer experience
 */
export const ContractErrorHelpers = {
  throwContractNotFound: () => throwContractNotFoundError('CONTRACT_NOT_FOUND'),
  throwBlockchainNotFound: () =>
    throwContractNotFoundError('BLOCKCHAIN_NOT_FOUND'),
  throwInvalidContractAddress: () =>
    throwContractBadRequestError('INVALID_CONTRACT_ADDRESS'),
  throwInvalidBytecodeSize: () =>
    throwContractBadRequestError('INVALID_BYTECODE_SIZE'),
  throwCacheManagerUnavailable: () =>
    throwContractServiceUnavailableError('CACHE_MANAGER_UNAVAILABLE'),
  throwBidCalculationFailed: () =>
    throwContractInternalError('BID_CALCULATION_FAILED'),
  throwRiskAssessmentFailed: () =>
    throwContractInternalError('RISK_ASSESSMENT_FAILED'),
  throwCacheStatisticsUnavailable: () =>
    throwContractServiceUnavailableError('CACHE_STATISTICS_UNAVAILABLE'),
  throwBlockchainEventProcessingFailed: () =>
    throwContractInternalError('BLOCKCHAIN_EVENT_PROCESSING_FAILED'),
  throwInvalidBlockchainId: () =>
    throwContractBadRequestError('INVALID_BLOCKCHAIN_ID'),
};
