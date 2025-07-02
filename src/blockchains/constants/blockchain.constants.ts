/**
 * Timespan types for analytics and trends
 */
export enum TimespanType {
  DAILY = 'D',
  WEEKLY = 'W',
  MONTHLY = 'M',
  YEARLY = 'Y',
}

/**
 * Contract size ranges for bid analytics (in KB)
 */
export enum ContractSizeRange {
  SMALL_MAX = 800, // KB - Small contracts: 0-800KB
  MEDIUM_MAX = 1600, // KB - Medium contracts: 800-1600KB
  // Large contracts: >1600KB
}

/**
 * Timespan duration in milliseconds
 */
export const TIMESPAN_MS = {
  [TimespanType.DAILY]: 24 * 60 * 60 * 1000,
  [TimespanType.WEEKLY]: 7 * 24 * 60 * 60 * 1000,
  [TimespanType.MONTHLY]: 30 * 24 * 60 * 60 * 1000,
  [TimespanType.YEARLY]: 365 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Date format patterns for SQL queries based on timespan
 */
export const DATE_FORMAT_PATTERNS = {
  [TimespanType.DAILY]: 'YYYY-MM-DD',
  [TimespanType.WEEKLY]: 'YYYY-WW',
  [TimespanType.MONTHLY]: 'YYYY-MM',
  [TimespanType.YEARLY]: 'YYYY',
} as const;

/**
 * Number of periods to look back for trend analysis
 */
export const TREND_PERIODS = {
  DEFAULT: 12,
  BYTECODE_TRENDS: 2,
} as const;

/**
 * Blockchain event names
 */
export enum BlockchainEventName {
  INSERT_BID = 'InsertBid',
  DELETE_BID = 'DeleteBid',
  SET_DECAY_RATE = 'SetDecayRate',
}

/**
 * Unit conversion constants
 */
export const UNIT_CONVERSIONS = {
  BYTES_TO_KB: 1024,
  BYTES_TO_MB: 1024 * 1024,
  KB_TO_BYTES: 1024,
  MB_TO_BYTES: 1024 * 1024,
} as const;
