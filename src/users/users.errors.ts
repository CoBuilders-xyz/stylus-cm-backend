import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

export enum UsersErrorCode {
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  ALERTS_SETTINGS_UPDATE_FAILED = 'ALERTS_SETTINGS_UPDATE_FAILED',
  INVALID_ALERTS_SETTINGS = 'INVALID_ALERTS_SETTINGS',
  USER_CREATION_FAILED = 'USER_CREATION_FAILED',
  INVALID_CHANNEL_TYPE = 'INVALID_CHANNEL_TYPE',
  ALERTS_SETTINGS_RETRIEVAL_FAILED = 'ALERTS_SETTINGS_RETRIEVAL_FAILED',
}

export const UsersErrors = {
  USER_NOT_FOUND: {
    error: UsersErrorCode.USER_NOT_FOUND,
    message: 'User not found with the provided address',
  },
  INVALID_ADDRESS: {
    error: UsersErrorCode.INVALID_ADDRESS,
    message: 'Invalid Ethereum address provided',
  },
  ALERTS_SETTINGS_UPDATE_FAILED: {
    error: UsersErrorCode.ALERTS_SETTINGS_UPDATE_FAILED,
    message: 'Failed to update alerts settings',
  },
  INVALID_ALERTS_SETTINGS: {
    error: UsersErrorCode.INVALID_ALERTS_SETTINGS,
    message: 'Invalid alerts settings provided',
  },
  USER_CREATION_FAILED: {
    error: UsersErrorCode.USER_CREATION_FAILED,
    message: 'Failed to create new user account',
  },
  INVALID_CHANNEL_TYPE: {
    error: UsersErrorCode.INVALID_CHANNEL_TYPE,
    message: 'Invalid notification channel type provided',
  },
  ALERTS_SETTINGS_RETRIEVAL_FAILED: {
    error: UsersErrorCode.ALERTS_SETTINGS_RETRIEVAL_FAILED,
    message: 'Failed to retrieve alerts settings',
  },
} as const;

/**
 * Helper functions to throw specific users errors
 */
export const throwUsersNotFoundError = (
  errorType: keyof typeof UsersErrors,
): never => {
  throw new NotFoundException(UsersErrors[errorType]);
};

export const throwUsersBadRequestError = (
  errorType: keyof typeof UsersErrors,
): never => {
  throw new BadRequestException(UsersErrors[errorType]);
};

export const throwUsersInternalError = (
  errorType: keyof typeof UsersErrors,
): never => {
  throw new InternalServerErrorException(UsersErrors[errorType]);
};

/**
 * Specific error thrower functions for better developer experience
 */
export const UsersErrorHelpers = {
  throwUserNotFound: () => throwUsersNotFoundError('USER_NOT_FOUND'),
  throwInvalidAddress: () => throwUsersBadRequestError('INVALID_ADDRESS'),
  throwAlertsSettingsUpdateFailed: () =>
    throwUsersInternalError('ALERTS_SETTINGS_UPDATE_FAILED'),
  throwInvalidAlertsSettings: () =>
    throwUsersBadRequestError('INVALID_ALERTS_SETTINGS'),
  throwUserCreationFailed: () =>
    throwUsersInternalError('USER_CREATION_FAILED'),
  throwInvalidChannelType: () =>
    throwUsersBadRequestError('INVALID_CHANNEL_TYPE'),
  throwAlertsSettingsRetrievalFailed: () =>
    throwUsersInternalError('ALERTS_SETTINGS_RETRIEVAL_FAILED'),
};
