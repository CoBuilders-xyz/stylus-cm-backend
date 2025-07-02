/**
 * Base interface for all event data
 */
export interface BaseEventData {
  eventName: string;
}

/**
 * InsertBid event data structure
 */
export interface InsertBidEventData extends BaseEventData {
  eventName: 'InsertBid';
  bytecodeHash: string;
  address: string;
  bidValue: string;
  size: string;
}

/**
 * DeleteBid event data structure
 */
export interface DeleteBidEventData extends BaseEventData {
  eventName: 'DeleteBid';
  bytecodeHash: string;
  bidValue: string;
  size: string;
}

/**
 * ContractAdded event data structure
 */
export interface ContractAddedEventData extends BaseEventData {
  eventName: 'ContractAdded';
  user: string;
  address: string;
  maxBid: string;
}

/**
 * ContractUpdated event data structure
 */
export interface ContractUpdatedEventData extends BaseEventData {
  eventName: 'ContractUpdated';
  address: string;
  bytecodeHash: string;
}

/**
 * SetDecayRate event data structure
 */
export interface SetDecayRateEventData extends BaseEventData {
  eventName: 'SetDecayRate';
  decayRate: string;
}

/**
 * SetCacheSize event data structure
 */
export interface SetCacheSizeEventData extends BaseEventData {
  eventName: 'SetCacheSize';
  cacheSize: string;
}

/**
 * Union type for all supported event data types
 */
export type EventData =
  | InsertBidEventData
  | DeleteBidEventData
  | ContractAddedEventData
  | ContractUpdatedEventData
  | SetDecayRateEventData
  | SetCacheSizeEventData;

/**
 * Validates if a string is a valid Ethereum address
 */
function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validates if a string is a valid positive number
 */
function isValidPositiveNumber(value: string): boolean {
  try {
    const num = BigInt(value);
    return num >= BigInt(0);
  } catch {
    return false;
  }
}

/**
 * Validates if a string is a valid bytecode hash
 */
function isValidBytecodeHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * Type guard functions for event data validation
 */
export const EventDataGuards = {
  isInsertBidEventData: (
    data: unknown[],
  ): data is [string, string, string, string] => {
    return (
      Array.isArray(data) &&
      data.length === 4 &&
      data.every((item) => typeof item === 'string') &&
      isValidBytecodeHash(data[0]) && // bytecodeHash
      isValidEthereumAddress(data[1]) && // address
      isValidPositiveNumber(data[2]) && // bidValue
      isValidPositiveNumber(data[3]) // size
    );
  },

  isDeleteBidEventData: (data: unknown[]): data is [string, string, string] => {
    return (
      Array.isArray(data) &&
      data.length === 3 &&
      data.every((item) => typeof item === 'string') &&
      isValidBytecodeHash(data[0]) && // bytecodeHash
      isValidPositiveNumber(data[1]) && // bidValue
      isValidPositiveNumber(data[2]) // size
    );
  },

  isContractAddedEventData: (
    data: unknown[],
  ): data is [string, string, string] => {
    return (
      Array.isArray(data) &&
      data.length === 3 &&
      data.every((item) => typeof item === 'string') &&
      isValidEthereumAddress(data[0]) && // user
      isValidEthereumAddress(data[1]) && // address
      isValidPositiveNumber(data[2]) // maxBid
    );
  },

  isContractUpdatedEventData: (data: unknown[]): data is [string, string] => {
    return (
      Array.isArray(data) &&
      data.length === 2 &&
      data.every((item) => typeof item === 'string') &&
      isValidEthereumAddress(data[0]) && // address
      isValidBytecodeHash(data[1]) // bytecodeHash
    );
  },

  isSetDecayRateEventData: (data: unknown[]): data is [string] => {
    return (
      Array.isArray(data) &&
      data.length === 1 &&
      typeof data[0] === 'string' &&
      isValidPositiveNumber(data[0]) // decayRate
    );
  },

  isSetCacheSizeEventData: (data: unknown[]): data is [string] => {
    return (
      Array.isArray(data) &&
      data.length === 1 &&
      typeof data[0] === 'string' &&
      isValidPositiveNumber(data[0]) // cacheSize
    );
  },
};
