import {
  InternalServerErrorException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';

export enum StateFetcherErrorCode {
  BLOCKCHAIN_CONNECTION_FAILED = 'BLOCKCHAIN_CONNECTION_FAILED',
  CONTRACT_CALL_FAILED = 'CONTRACT_CALL_FAILED',
  INVALID_BLOCKCHAIN_CONFIG = 'INVALID_BLOCKCHAIN_CONFIG',
  STATE_SAVE_FAILED = 'STATE_SAVE_FAILED',
  PROVIDER_CREATION_FAILED = 'PROVIDER_CREATION_FAILED',
  BLOCK_FETCH_FAILED = 'BLOCK_FETCH_FAILED',
  CONTRACT_ENTRIES_FETCH_FAILED = 'CONTRACT_ENTRIES_FETCH_FAILED',
  POLLING_TIMEOUT = 'POLLING_TIMEOUT',
}

export const StateFetcherErrors = {
  BLOCKCHAIN_CONNECTION_FAILED: {
    error: StateFetcherErrorCode.BLOCKCHAIN_CONNECTION_FAILED,
    message: 'Failed to connect to blockchain network',
  },
  CONTRACT_CALL_FAILED: {
    error: StateFetcherErrorCode.CONTRACT_CALL_FAILED,
    message: 'Failed to call smart contract method',
  },
  INVALID_BLOCKCHAIN_CONFIG: {
    error: StateFetcherErrorCode.INVALID_BLOCKCHAIN_CONFIG,
    message: 'Blockchain configuration is invalid or incomplete',
  },
  STATE_SAVE_FAILED: {
    error: StateFetcherErrorCode.STATE_SAVE_FAILED,
    message: 'Failed to save blockchain state to database',
  },
  PROVIDER_CREATION_FAILED: {
    error: StateFetcherErrorCode.PROVIDER_CREATION_FAILED,
    message: 'Failed to create blockchain provider',
  },
  BLOCK_FETCH_FAILED: {
    error: StateFetcherErrorCode.BLOCK_FETCH_FAILED,
    message: 'Failed to fetch latest block information',
  },
  CONTRACT_ENTRIES_FETCH_FAILED: {
    error: StateFetcherErrorCode.CONTRACT_ENTRIES_FETCH_FAILED,
    message: 'Failed to fetch contract entries from cache manager',
  },
  POLLING_TIMEOUT: {
    error: StateFetcherErrorCode.POLLING_TIMEOUT,
    message: 'Blockchain polling operation timed out',
  },
} as const;

/**
 * Helper functions to throw specific state fetcher errors
 */
export const throwStateFetcherError = (
  errorType: keyof typeof StateFetcherErrors,
): never => {
  throw new InternalServerErrorException(StateFetcherErrors[errorType]);
};

export const throwStateFetcherBadRequestError = (
  errorType: keyof typeof StateFetcherErrors,
): never => {
  throw new BadRequestException(StateFetcherErrors[errorType]);
};

export const throwStateFetcherServiceUnavailableError = (
  errorType: keyof typeof StateFetcherErrors,
): never => {
  throw new ServiceUnavailableException(StateFetcherErrors[errorType]);
};

/**
 * Specific error thrower functions for better developer experience
 */
export const StateFetcherErrorHelpers = {
  throwBlockchainConnectionFailed: () =>
    throwStateFetcherServiceUnavailableError('BLOCKCHAIN_CONNECTION_FAILED'),
  throwContractCallFailed: () => throwStateFetcherError('CONTRACT_CALL_FAILED'),
  throwInvalidBlockchainConfig: () =>
    throwStateFetcherBadRequestError('INVALID_BLOCKCHAIN_CONFIG'),
  throwStateSaveFailed: () => throwStateFetcherError('STATE_SAVE_FAILED'),
  throwProviderCreationFailed: () =>
    throwStateFetcherError('PROVIDER_CREATION_FAILED'),
  throwBlockFetchFailed: () => throwStateFetcherError('BLOCK_FETCH_FAILED'),
  throwContractEntriesFetchFailed: () =>
    throwStateFetcherError('CONTRACT_ENTRIES_FETCH_FAILED'),
  throwPollingTimeout: () =>
    throwStateFetcherServiceUnavailableError('POLLING_TIMEOUT'),
};
