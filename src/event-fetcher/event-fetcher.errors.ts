import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

export enum EventFetcherErrorCode {
  // Configuration Errors
  MISSING_WEBSOCKET_URL = 'MISSING_WEBSOCKET_URL',
  MISSING_CONTRACT_ADDRESS = 'MISSING_CONTRACT_ADDRESS',
  MISSING_RPC_URL = 'MISSING_RPC_URL',
  INVALID_BLOCKCHAIN_CONFIG = 'INVALID_BLOCKCHAIN_CONFIG',
  INVALID_EVENT_TYPES = 'INVALID_EVENT_TYPES',

  // State Management Errors
  RECONNECTION_CALLBACKS_NOT_REGISTERED = 'RECONNECTION_CALLBACKS_NOT_REGISTERED',
  LISTENER_SETUP_FAILED = 'LISTENER_SETUP_FAILED',

  // Connection/Network Errors
  WEBSOCKET_CONNECTION_FAILED = 'WEBSOCKET_CONNECTION_FAILED',
  CONTRACT_CALL_FAILED = 'CONTRACT_CALL_FAILED',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',

  // Event Processing Errors
  EVENT_PROCESSING_FAILED = 'EVENT_PROCESSING_FAILED',
  EVENT_STORAGE_FAILED = 'EVENT_STORAGE_FAILED',
  HISTORICAL_SYNC_FAILED = 'HISTORICAL_SYNC_FAILED',
}

export const EventFetcherErrors = {
  MISSING_WEBSOCKET_URL: {
    error: EventFetcherErrorCode.MISSING_WEBSOCKET_URL,
    message: 'Missing WebSocket URL for blockchain configuration',
  },
  MISSING_CONTRACT_ADDRESS: {
    error: EventFetcherErrorCode.MISSING_CONTRACT_ADDRESS,
    message: 'Missing contract address for blockchain configuration',
  },
  MISSING_RPC_URL: {
    error: EventFetcherErrorCode.MISSING_RPC_URL,
    message: 'Missing RPC URL for blockchain configuration',
  },
  INVALID_BLOCKCHAIN_CONFIG: {
    error: EventFetcherErrorCode.INVALID_BLOCKCHAIN_CONFIG,
    message: 'Invalid blockchain configuration provided',
  },
  INVALID_EVENT_TYPES: {
    error: EventFetcherErrorCode.INVALID_EVENT_TYPES,
    message: 'Invalid event types configuration. Must be a non-empty array',
  },
  RECONNECTION_CALLBACKS_NOT_REGISTERED: {
    error: EventFetcherErrorCode.RECONNECTION_CALLBACKS_NOT_REGISTERED,
    message:
      'Reconnection callbacks must be registered before handling reconnections',
  },
  LISTENER_SETUP_FAILED: {
    error: EventFetcherErrorCode.LISTENER_SETUP_FAILED,
    message: 'Failed to set up event listeners for blockchain',
  },
  WEBSOCKET_CONNECTION_FAILED: {
    error: EventFetcherErrorCode.WEBSOCKET_CONNECTION_FAILED,
    message: 'Failed to establish WebSocket connection',
  },
  CONTRACT_CALL_FAILED: {
    error: EventFetcherErrorCode.CONTRACT_CALL_FAILED,
    message: 'Contract call failed after maximum retries',
  },
  PROVIDER_UNAVAILABLE: {
    error: EventFetcherErrorCode.PROVIDER_UNAVAILABLE,
    message: 'Blockchain provider is unavailable or not responding',
  },
  EVENT_PROCESSING_FAILED: {
    error: EventFetcherErrorCode.EVENT_PROCESSING_FAILED,
    message: 'Failed to process blockchain event',
  },
  EVENT_STORAGE_FAILED: {
    error: EventFetcherErrorCode.EVENT_STORAGE_FAILED,
    message: 'Failed to store blockchain event data',
  },
  HISTORICAL_SYNC_FAILED: {
    error: EventFetcherErrorCode.HISTORICAL_SYNC_FAILED,
    message: 'Failed to synchronize historical blockchain events',
  },
} as const;

/**
 * Helper functions to throw specific event-fetcher errors
 */
export const throwEventFetcherNotFoundError = (
  errorType: keyof typeof EventFetcherErrors,
): never => {
  throw new NotFoundException(EventFetcherErrors[errorType]);
};

export const throwEventFetcherBadRequestError = (
  errorType: keyof typeof EventFetcherErrors,
): never => {
  throw new BadRequestException(EventFetcherErrors[errorType]);
};

export const throwEventFetcherInternalError = (
  errorType: keyof typeof EventFetcherErrors,
): never => {
  throw new InternalServerErrorException(EventFetcherErrors[errorType]);
};

export const throwEventFetcherServiceUnavailableError = (
  errorType: keyof typeof EventFetcherErrors,
): never => {
  throw new ServiceUnavailableException(EventFetcherErrors[errorType]);
};

/**
 * Specific error helper functions for better developer experience
 */
export const EventFetcherErrorHelpers = {
  // Configuration Errors (BadRequest)
  throwMissingWebSocketUrl: () =>
    throwEventFetcherBadRequestError('MISSING_WEBSOCKET_URL'),
  throwMissingContractAddress: () =>
    throwEventFetcherBadRequestError('MISSING_CONTRACT_ADDRESS'),
  throwMissingRpcUrl: () => throwEventFetcherBadRequestError('MISSING_RPC_URL'),
  throwInvalidBlockchainConfig: () =>
    throwEventFetcherBadRequestError('INVALID_BLOCKCHAIN_CONFIG'),
  throwInvalidEventTypes: () =>
    throwEventFetcherBadRequestError('INVALID_EVENT_TYPES'),

  // State Management Errors (InternalServerError)
  throwReconnectionCallbacksNotRegistered: () =>
    throwEventFetcherInternalError('RECONNECTION_CALLBACKS_NOT_REGISTERED'),
  throwListenerSetupFailed: () =>
    throwEventFetcherInternalError('LISTENER_SETUP_FAILED'),

  // Connection Errors (ServiceUnavailable)
  throwWebSocketConnectionFailed: () =>
    throwEventFetcherServiceUnavailableError('WEBSOCKET_CONNECTION_FAILED'),
  throwProviderUnavailable: () =>
    throwEventFetcherServiceUnavailableError('PROVIDER_UNAVAILABLE'),

  // Processing Errors (InternalServerError)
  throwContractCallFailed: () =>
    throwEventFetcherInternalError('CONTRACT_CALL_FAILED'),
  throwEventProcessingFailed: () =>
    throwEventFetcherInternalError('EVENT_PROCESSING_FAILED'),
  throwEventStorageFailed: () =>
    throwEventFetcherInternalError('EVENT_STORAGE_FAILED'),
  throwHistoricalSyncFailed: () =>
    throwEventFetcherInternalError('HISTORICAL_SYNC_FAILED'),
};
