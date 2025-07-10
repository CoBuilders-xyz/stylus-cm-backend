import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Error codes for the Alerts module
 */
export enum AlertsErrorCode {
  ALERT_NOT_FOUND = 'ALERT_NOT_FOUND',
  USER_CONTRACT_NOT_FOUND = 'USER_CONTRACT_NOT_FOUND',
  INVALID_ALERT_TYPE = 'INVALID_ALERT_TYPE',
  INVALID_ALERT_VALUE = 'INVALID_ALERT_VALUE',
  ALERT_ALREADY_EXISTS = 'ALERT_ALREADY_EXISTS',
  MONITORING_ERROR = 'MONITORING_ERROR',
  EVENT_PROCESSING_ERROR = 'EVENT_PROCESSING_ERROR',
  NOTIFICATION_CHANNEL_ERROR = 'NOTIFICATION_CHANNEL_ERROR',
  ALERT_CONDITION_ERROR = 'ALERT_CONDITION_ERROR',
  QUEUE_PROCESSING_ERROR = 'QUEUE_PROCESSING_ERROR',
  UNAUTHORIZED_ALERT_ACCESS = 'UNAUTHORIZED_ALERT_ACCESS',
  INVALID_NOTIFICATION_CHANNELS = 'INVALID_NOTIFICATION_CHANNELS',
  ALERT_COOLDOWN_ACTIVE = 'ALERT_COOLDOWN_ACTIVE',
  MAX_ALERTS_EXCEEDED = 'MAX_ALERTS_EXCEEDED',
}

/**
 * Error definitions with structured error messages
 */
export const AlertsErrors = {
  ALERT_NOT_FOUND: {
    error: AlertsErrorCode.ALERT_NOT_FOUND,
    message: 'Alert not found with the provided ID',
  },
  USER_CONTRACT_NOT_FOUND: {
    error: AlertsErrorCode.USER_CONTRACT_NOT_FOUND,
    message: 'User contract not found for the specified alert',
  },
  INVALID_ALERT_TYPE: {
    error: AlertsErrorCode.INVALID_ALERT_TYPE,
    message:
      'Invalid alert type provided. Must be one of: eviction, noGas, lowGas, bidSafety',
  },
  INVALID_ALERT_VALUE: {
    error: AlertsErrorCode.INVALID_ALERT_VALUE,
    message: 'Invalid alert value for the specified alert type',
  },
  ALERT_ALREADY_EXISTS: {
    error: AlertsErrorCode.ALERT_ALREADY_EXISTS,
    message: 'Alert of this type already exists for the specified contract',
  },
  MONITORING_ERROR: {
    error: AlertsErrorCode.MONITORING_ERROR,
    message: 'Error occurred during alert monitoring process',
  },
  EVENT_PROCESSING_ERROR: {
    error: AlertsErrorCode.EVENT_PROCESSING_ERROR,
    message: 'Error processing blockchain event for alerts',
  },
  NOTIFICATION_CHANNEL_ERROR: {
    error: AlertsErrorCode.NOTIFICATION_CHANNEL_ERROR,
    message: 'Error with notification channel configuration',
  },
  ALERT_CONDITION_ERROR: {
    error: AlertsErrorCode.ALERT_CONDITION_ERROR,
    message: 'Error evaluating alert condition',
  },
  QUEUE_PROCESSING_ERROR: {
    error: AlertsErrorCode.QUEUE_PROCESSING_ERROR,
    message: 'Error processing alert queue',
  },
  UNAUTHORIZED_ALERT_ACCESS: {
    error: AlertsErrorCode.UNAUTHORIZED_ALERT_ACCESS,
    message: 'User not authorized to access this alert',
  },
  INVALID_NOTIFICATION_CHANNELS: {
    error: AlertsErrorCode.INVALID_NOTIFICATION_CHANNELS,
    message: 'At least one notification channel must be enabled',
  },
  ALERT_COOLDOWN_ACTIVE: {
    error: AlertsErrorCode.ALERT_COOLDOWN_ACTIVE,
    message: 'Alert is in cooldown period and cannot be triggered',
  },
  MAX_ALERTS_EXCEEDED: {
    error: AlertsErrorCode.MAX_ALERTS_EXCEEDED,
    message: 'Maximum number of alerts per user contract exceeded',
  },
} as const;

/**
 * Helper functions for throwing specific alert errors
 */
export const AlertsErrorHelpers = {
  // NotFound Errors (404)
  throwAlertNotFound: (alertId?: string) => {
    const message = alertId
      ? `Alert not found with ID: ${alertId}`
      : AlertsErrors.ALERT_NOT_FOUND.message;
    throw new NotFoundException({
      ...AlertsErrors.ALERT_NOT_FOUND,
      message,
    });
  },

  throwUserContractNotFound: (userContractId?: string) => {
    const message = userContractId
      ? `User contract not found with ID: ${userContractId}`
      : AlertsErrors.USER_CONTRACT_NOT_FOUND.message;
    throw new NotFoundException({
      ...AlertsErrors.USER_CONTRACT_NOT_FOUND,
      message,
    });
  },

  // BadRequest Errors (400)
  throwInvalidAlertType: (providedType?: string) => {
    const message = providedType
      ? `Invalid alert type '${providedType}'. Must be one of: eviction, noGas, lowGas, bidSafety`
      : AlertsErrors.INVALID_ALERT_TYPE.message;
    throw new BadRequestException({
      ...AlertsErrors.INVALID_ALERT_TYPE,
      message,
    });
  },

  throwInvalidAlertValue: (alertType?: string, providedValue?: string) => {
    const baseError = AlertsErrors.INVALID_ALERT_VALUE;
    const message =
      alertType && providedValue
        ? `Invalid value '${providedValue}' for alert type '${alertType}'`
        : baseError.message;
    throw new BadRequestException({
      error: baseError.error,
      message,
    });
  },

  throwInvalidNotificationChannels: () => {
    throw new BadRequestException({
      ...AlertsErrors.INVALID_NOTIFICATION_CHANNELS,
    });
  },

  // Conflict Errors (409)
  throwAlertAlreadyExists: (alertType?: string, userContractId?: string) => {
    const message =
      alertType && userContractId
        ? `Alert of type '${alertType}' already exists for contract '${userContractId}'`
        : AlertsErrors.ALERT_ALREADY_EXISTS.message;
    throw new ConflictException({
      ...AlertsErrors.ALERT_ALREADY_EXISTS,
      message,
    });
  },

  throwAlertCooldownActive: (remainingTime?: number) => {
    const message = remainingTime
      ? `Alert is in cooldown period. ${remainingTime} seconds remaining.`
      : AlertsErrors.ALERT_COOLDOWN_ACTIVE.message;
    throw new ConflictException({
      ...AlertsErrors.ALERT_COOLDOWN_ACTIVE,
      message,
    });
  },

  throwMaxAlertsExceeded: (currentCount?: number, maxCount?: number) => {
    const message =
      currentCount && maxCount
        ? `Maximum alerts exceeded: ${currentCount}/${maxCount} alerts per user contract`
        : AlertsErrors.MAX_ALERTS_EXCEEDED.message;
    throw new BadRequestException({
      ...AlertsErrors.MAX_ALERTS_EXCEEDED,
      message,
    });
  },

  // Forbidden Errors (403)
  throwUnauthorizedAlertAccess: (userId?: string, alertId?: string) => {
    const message =
      userId && alertId
        ? `User '${userId}' not authorized to access alert '${alertId}'`
        : AlertsErrors.UNAUTHORIZED_ALERT_ACCESS.message;
    throw new ForbiddenException({
      ...AlertsErrors.UNAUTHORIZED_ALERT_ACCESS,
      message,
    });
  },

  // InternalServerError Errors (500)
  throwMonitoringError: (details?: string) => {
    const message = details
      ? `${AlertsErrors.MONITORING_ERROR.message}: ${details}`
      : AlertsErrors.MONITORING_ERROR.message;
    throw new InternalServerErrorException({
      ...AlertsErrors.MONITORING_ERROR,
      message,
    });
  },

  throwEventProcessingError: (eventId?: string, details?: string) => {
    const baseMessage = AlertsErrors.EVENT_PROCESSING_ERROR.message;
    const message =
      eventId && details
        ? `${baseMessage} for event '${eventId}': ${details}`
        : eventId
          ? `${baseMessage} for event '${eventId}'`
          : baseMessage;
    throw new InternalServerErrorException({
      ...AlertsErrors.EVENT_PROCESSING_ERROR,
      message,
    });
  },

  throwNotificationChannelError: (channel?: string, details?: string) => {
    const baseMessage = AlertsErrors.NOTIFICATION_CHANNEL_ERROR.message;
    const message =
      channel && details
        ? `${baseMessage} for channel '${channel}': ${details}`
        : channel
          ? `${baseMessage} for channel '${channel}'`
          : baseMessage;
    throw new InternalServerErrorException({
      ...AlertsErrors.NOTIFICATION_CHANNEL_ERROR,
      message,
    });
  },

  throwAlertConditionError: (alertType?: string, details?: string) => {
    const baseMessage = AlertsErrors.ALERT_CONDITION_ERROR.message;
    const message =
      alertType && details
        ? `${baseMessage} for alert type '${alertType}': ${details}`
        : alertType
          ? `${baseMessage} for alert type '${alertType}'`
          : baseMessage;
    throw new InternalServerErrorException({
      ...AlertsErrors.ALERT_CONDITION_ERROR,
      message,
    });
  },

  throwQueueProcessingError: (queueName?: string, details?: string) => {
    const baseMessage = AlertsErrors.QUEUE_PROCESSING_ERROR.message;
    const message =
      queueName && details
        ? `${baseMessage} for queue '${queueName}': ${details}`
        : queueName
          ? `${baseMessage} for queue '${queueName}'`
          : baseMessage;
    throw new InternalServerErrorException({
      ...AlertsErrors.QUEUE_PROCESSING_ERROR,
      message,
    });
  },
};
