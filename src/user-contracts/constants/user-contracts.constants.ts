/**
 * Default values for user contract creation
 */
export const USER_CONTRACT_DEFAULTS = {
  CONTRACT: {
    LAST_BID: '0',
    BID_PLUS_DECAY: '0',
    TOTAL_BID_INVESTMENT: '0',
    IS_AUTOMATED: false,
    MAX_BID: '0',
  },
  BYTECODE: {
    LAST_BID: '0',
    BID_PLUS_DECAY: '0',
    LAST_EVICTION_BID: '0',
    IS_CACHED: false,
    TOTAL_BID_INVESTMENT: '0',
  },
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
  },
  VALIDATION: {
    MIN_NAME_LENGTH: 1,
    MAX_NAME_LENGTH: 255,
    ADDRESS_REGEX: /^0x[a-fA-F0-9]{40}$/,
  },
} as const;

/**
 * Module name for consistent logging
 */
export const MODULE_NAME = 'UserContracts';

/**
 * Database query constants
 */
export const QUERY_CONSTANTS = {
  DEFAULT_RELATIONS: [
    'contract',
    'contract.bytecode',
    'blockchain',
    'contract.blockchain',
  ],
  SEARCH_FIELDS: ['userContract.address', 'userContract.name'],
} as const;

/**
 * Blockchain interaction constants
 */
export const BLOCKCHAIN_CONSTANTS = {
  EMPTY_BYTECODE: '0x',
  EMPTY_BYTECODE_ALT: '',
} as const;
