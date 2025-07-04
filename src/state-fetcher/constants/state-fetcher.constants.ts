export const STATE_FETCHER_CONSTANTS = {
  DEFAULT_POLLING_INTERVAL: '*/5 * * * *', // Every 5 minutes
  DEFAULT_CONTRACT_TIMEOUT: 30000, // 30 seconds
  DEFAULT_MAX_RETRY_ATTEMPTS: 3,
  DEFAULT_RETRY_DELAY: 1000, // 1 second
  DEFAULT_MIN_BID: '0',

  VALIDATION_LIMITS: {
    MIN_TIMEOUT: 1000, // 1 second
    MAX_TIMEOUT: 300000, // 5 minutes
    MIN_RETRY_DELAY: 100, // 100ms
    MAX_RETRY_DELAY: 60000, // 1 minute
    MIN_RETRY_ATTEMPTS: 0,
    MAX_RETRY_ATTEMPTS: 10,
  },

  LOG_LEVELS: {
    VERBOSE: 'verbose',
    DEBUG: 'debug',
    LOG: 'log',
    WARN: 'warn',
    ERROR: 'error',
  },
} as const;
