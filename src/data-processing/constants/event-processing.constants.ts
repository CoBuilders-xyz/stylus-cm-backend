/**
 * Constants for event processing configuration
 */
export const EVENT_DATA_SCHEMAS = {
  InsertBid: {
    requiredFields: 4,
    fields: ['bytecodeHash', 'address', 'bidValue', 'size'],
  },
  DeleteBid: {
    requiredFields: 3,
    fields: ['bytecodeHash', 'bidValue', 'size'],
  },
  SetDecayRate: {
    requiredFields: 1,
    fields: ['decayRate'],
  },
  SetCacheSize: {
    requiredFields: 1,
    fields: ['cacheSize'],
  },
} as const;

/**
 * Time conversion constants
 */
export const TIME_CONSTANTS = {
  SECONDS_IN_MILLISECOND: 1000,
} as const;

/**
 * Default values for processing
 */
export const DEFAULT_VALUES = {
  DECAY_RATE: '0',
  BID_VALUE: '0',
  TOTAL_INVESTMENT: '0',
} as const;

/**
 * Event type names
 */
export const EVENT_TYPES = {
  INSERT_BID: 'InsertBid',
  DELETE_BID: 'DeleteBid',
  SET_DECAY_RATE: 'SetDecayRate',
  SET_CACHE_SIZE: 'SetCacheSize',
} as const;
