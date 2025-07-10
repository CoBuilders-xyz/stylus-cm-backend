/**
 * Users Module Constants
 */

export const MODULE_NAME = 'Users';

/**
 * Default settings for new users
 */
export const DEFAULT_ALERTS_SETTINGS = {
  emailSettings: {
    enabled: false,
    destination: '',
  },
  telegramSettings: {
    enabled: false,
    destination: '',
  },
  slackSettings: {
    enabled: false,
    destination: '',
  },
  webhookSettings: {
    enabled: false,
    destination: '',
  },
};

/**
 * Validation messages
 */
export const VALIDATION_MESSAGES = {
  INVALID_ADDRESS: 'Invalid Ethereum address format',
  INVALID_EMAIL: 'Invalid email address format',
  INVALID_URL: 'Invalid URL format',
  DESTINATION_REQUIRED:
    'Destination is required when notifications are enabled',
  ENABLED_REQUIRED: 'Enabled field is required',
  INVALID_CHANNEL_TYPE: 'Invalid notification channel type',
};

/**
 * Alert channel types
 */
export const ALERT_CHANNEL_TYPES = {
  EMAIL: 'emailSettings',
  TELEGRAM: 'telegramSettings',
  SLACK: 'slackSettings',
  WEBHOOK: 'webhookSettings',
} as const;

/**
 * User entity field names
 */
export const USER_ENTITY_FIELDS = {
  ID: 'id',
  ADDRESS: 'address',
  NAME: 'name',
  IS_ACTIVE: 'isActive',
  ALERTS_SETTINGS: 'alertsSettings',
} as const;

/**
 * Database constraints
 */
export const DB_CONSTRAINTS = {
  ADDRESS_MAX_LENGTH: 42, // Ethereum address length
  NAME_MAX_LENGTH: 100,
  DESTINATION_MAX_LENGTH: 255,
};

/**
 * User settings keys
 */
export const USER_SETTINGS_KEYS = Object.values(ALERT_CHANNEL_TYPES);
