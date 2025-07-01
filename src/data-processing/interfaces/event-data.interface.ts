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
 * Type guard functions for event data validation
 */
export const EventDataGuards = {
  isInsertBidEventData: (
    data: unknown[],
  ): data is [string, string, string, string] => {
    return (
      Array.isArray(data) &&
      data.length === 4 &&
      data.every((item) => typeof item === 'string')
    );
  },

  isDeleteBidEventData: (data: unknown[]): data is [string] => {
    return (
      Array.isArray(data) && data.length === 1 && typeof data[0] === 'string'
    );
  },

  isContractAddedEventData: (
    data: unknown[],
  ): data is [string, string, string] => {
    return (
      Array.isArray(data) &&
      data.length === 3 &&
      data.every((item) => typeof item === 'string')
    );
  },

  isContractUpdatedEventData: (data: unknown[]): data is [string, string] => {
    return (
      Array.isArray(data) &&
      data.length === 2 &&
      data.every((item) => typeof item === 'string')
    );
  },

  isSetDecayRateEventData: (data: unknown[]): data is [string] => {
    return (
      Array.isArray(data) && data.length === 1 && typeof data[0] === 'string'
    );
  },

  isSetCacheSizeEventData: (data: unknown[]): data is [string] => {
    return (
      Array.isArray(data) && data.length === 1 && typeof data[0] === 'string'
    );
  },
};
