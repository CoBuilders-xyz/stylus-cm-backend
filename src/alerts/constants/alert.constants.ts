/**
 * Alert type enumeration
 * Moved from entity to centralized constants
 */
export enum AlertType {
  EVICTION = 'eviction',
  NO_GAS = 'noGas',
  LOW_GAS = 'lowGas',
  BID_SAFETY = 'bidSafety',
}

/**
 * Alert status enumeration for tracking alert states
 */
export enum AlertStatus {
  ACTIVE = 'active',
  TRIGGERED = 'triggered',
  PAUSED = 'paused',
}

/**
 * Alert threshold configurations and validation limits
 */
export const ALERT_THRESHOLDS = {
  BID_SAFETY_BASE_PERCENTAGE: 10000, // 100% in basis points (for BigInt precision)
  MIN_BID_SAFETY_VALUE: 1, // 1% minimum safety margin
  MAX_BID_SAFETY_VALUE: 100, // 100% maximum safety margin
  ALERT_COOLDOWN_MINUTES: 5, // Minimum time between alerts for same condition
  MAX_TRIGGERED_COUNT: 1000, // Maximum times an alert can be triggered
} as const;

/**
 * Monitoring and processing configuration
 */
export const MONITORING_CONFIG = {
  REAL_TIME_CHECK_INTERVAL: '*/1 * * * *', // Every minute cron expression
  EVENT_PROCESSING_TIMEOUT: 30000, // 30 seconds timeout for event processing
  QUEUE_RETRY_ATTEMPTS: 3, // Number of retry attempts for failed queue jobs
  BATCH_PROCESSING_SIZE: 50, // Number of alerts to process in a batch
  ALERT_DEDUPLICATION_WINDOW: 300000, // 5 minutes in milliseconds
} as const;

/**
 * Notification channel constants
 */
export const NOTIFICATION_CHANNELS = {
  SLACK: 'slack',
  TELEGRAM: 'telegram',
  WEBHOOK: 'webhook',
} as const;

/**
 * Alert priority levels for notification urgency
 */
export enum AlertPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Alert priority mapping based on alert type
 */
export const ALERT_TYPE_PRIORITY: Record<AlertType, AlertPriority> = {
  [AlertType.EVICTION]: AlertPriority.CRITICAL,
  [AlertType.NO_GAS]: AlertPriority.HIGH,
  [AlertType.LOW_GAS]: AlertPriority.MEDIUM,
  [AlertType.BID_SAFETY]: AlertPriority.HIGH,
} as const;

/**
 * Module name for consistent logging
 */
export const MODULE_NAME = 'Alerts';

/**
 * Queue names for BullMQ
 */
export const QUEUE_NAMES = {
  ALERTS: 'alerts',
  ALERT_PROCESSING: 'alert-processing',
  NOTIFICATIONS: 'notifications',
} as const;

/**
 * Event names for internal event emission
 */
export const ALERT_EVENTS = {
  ALERT_TRIGGERED: 'alert.triggered',
  ALERT_CREATED: 'alert.created',
  ALERT_UPDATED: 'alert.updated',
  ALERT_DELETED: 'alert.deleted',
  MONITORING_ERROR: 'alert.monitoring.error',
} as const;
