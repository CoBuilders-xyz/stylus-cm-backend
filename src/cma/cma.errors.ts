import {
  InternalServerErrorException,
  BadRequestException,
  ServiceUnavailableException,
  NotFoundException,
} from '@nestjs/common';

export enum CmaErrorCode {
  BLOCKCHAIN_NOT_FOUND = 'BLOCKCHAIN_NOT_FOUND',
  CONTRACT_FETCH_FAILED = 'CONTRACT_FETCH_FAILED',
  CONTRACT_SELECTION_FAILED = 'CONTRACT_SELECTION_FAILED',
  BATCH_PROCESSING_FAILED = 'BATCH_PROCESSING_FAILED',
  ENGINE_COMMUNICATION_FAILED = 'ENGINE_COMMUNICATION_FAILED',
  PROVIDER_INITIALIZATION_FAILED = 'PROVIDER_INITIALIZATION_FAILED',
  AUTOMATION_CONFIG_INVALID = 'AUTOMATION_CONFIG_INVALID',
  CONTRACT_CODE_FETCH_FAILED = 'CONTRACT_CODE_FETCH_FAILED',
  BID_ASSESSMENT_FAILED = 'BID_ASSESSMENT_FAILED',
  CACHE_CHECK_FAILED = 'CACHE_CHECK_FAILED',
}

export const CmaErrors = {
  BLOCKCHAIN_NOT_FOUND: {
    error: CmaErrorCode.BLOCKCHAIN_NOT_FOUND,
    message: 'Blockchain configuration not found or not enabled',
  },
  CONTRACT_FETCH_FAILED: {
    error: CmaErrorCode.CONTRACT_FETCH_FAILED,
    message: 'Failed to fetch contracts from cache manager automation',
  },
  CONTRACT_SELECTION_FAILED: {
    error: CmaErrorCode.CONTRACT_SELECTION_FAILED,
    message: 'Failed to select optimal contracts for automation',
  },
  BATCH_PROCESSING_FAILED: {
    error: CmaErrorCode.BATCH_PROCESSING_FAILED,
    message: 'Failed to process contract batch for automation',
  },
  ENGINE_COMMUNICATION_FAILED: {
    error: CmaErrorCode.ENGINE_COMMUNICATION_FAILED,
    message: 'Failed to communicate with blockchain engine',
  },
  PROVIDER_INITIALIZATION_FAILED: {
    error: CmaErrorCode.PROVIDER_INITIALIZATION_FAILED,
    message: 'Failed to initialize blockchain provider',
  },
  AUTOMATION_CONFIG_INVALID: {
    error: CmaErrorCode.AUTOMATION_CONFIG_INVALID,
    message: 'Invalid automation configuration provided',
  },
  CONTRACT_CODE_FETCH_FAILED: {
    error: CmaErrorCode.CONTRACT_CODE_FETCH_FAILED,
    message: 'Failed to fetch contract code from blockchain',
  },
  BID_ASSESSMENT_FAILED: {
    error: CmaErrorCode.BID_ASSESSMENT_FAILED,
    message: 'Failed to assess contract bid eligibility',
  },
  CACHE_CHECK_FAILED: {
    error: CmaErrorCode.CACHE_CHECK_FAILED,
    message: 'Failed to check contract cache status',
  },
} as const;

/**
 * Helper functions to throw specific CMA errors
 */
export const throwCmaError = (errorType: keyof typeof CmaErrors): never => {
  throw new InternalServerErrorException(CmaErrors[errorType]);
};

export const throwCmaNotFoundError = (
  errorType: keyof typeof CmaErrors,
): never => {
  throw new NotFoundException(CmaErrors[errorType]);
};

export const throwCmaBadRequestError = (
  errorType: keyof typeof CmaErrors,
): never => {
  throw new BadRequestException(CmaErrors[errorType]);
};

export const throwCmaServiceUnavailableError = (
  errorType: keyof typeof CmaErrors,
): never => {
  throw new ServiceUnavailableException(CmaErrors[errorType]);
};

/**
 * Specific error thrower functions for better developer experience
 */
export const CmaErrorHelpers = {
  throwBlockchainNotFound: () => throwCmaNotFoundError('BLOCKCHAIN_NOT_FOUND'),
  throwContractFetchFailed: () => throwCmaError('CONTRACT_FETCH_FAILED'),
  throwContractSelectionFailed: () =>
    throwCmaError('CONTRACT_SELECTION_FAILED'),
  throwBatchProcessingFailed: () => throwCmaError('BATCH_PROCESSING_FAILED'),
  throwEngineCommincationFailed: () =>
    throwCmaServiceUnavailableError('ENGINE_COMMUNICATION_FAILED'),
  throwProviderInitializationFailed: () =>
    throwCmaError('PROVIDER_INITIALIZATION_FAILED'),
  throwAutomationConfigInvalid: () =>
    throwCmaBadRequestError('AUTOMATION_CONFIG_INVALID'),
  throwContractCodeFetchFailed: () =>
    throwCmaError('CONTRACT_CODE_FETCH_FAILED'),
  throwBidAssessmentFailed: () => throwCmaError('BID_ASSESSMENT_FAILED'),
  throwCacheCheckFailed: () => throwCmaError('CACHE_CHECK_FAILED'),
};
