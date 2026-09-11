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
 * Solidity: ContractUpdated(address indexed user, address indexed contractAddress, uint256 maxBid)
 */
export interface ContractUpdatedEventData extends BaseEventData {
  eventName: 'ContractUpdated';
  user: string;
  address: string;
  maxBid: string;
}

/**
 * ContractRemoved event data structure
 * Solidity: ContractRemoved(address indexed user, address indexed contractAddress)
 */
export interface ContractRemovedEventData extends BaseEventData {
  eventName: 'ContractRemoved';
  user: string;
  address: string;
}

/**
 * ContractBiddingEnabledUpdated event data structure
 * Solidity: ContractBiddingEnabledUpdated(address indexed user, address indexed contractAddress, bool biddingEnabled)
 */
export interface ContractBiddingEnabledUpdatedEventData extends BaseEventData {
  eventName: 'ContractBiddingEnabledUpdated';
  user: string;
  contractAddress: string;
  biddingEnabled: boolean;
}

/**
 * ActivationPerformed event data structure
 * Solidity: ActivationPerformed(address indexed user, address indexed contractAddress,
 *           uint16 version, uint256 dataFee, uint256 spent, uint256 refund, uint256 userBalance)
 */
export interface ActivationPerformedEventData extends BaseEventData {
  eventName: 'ActivationPerformed';
  user: string;
  contractAddress: string;
  version: string;
  dataFee: string;
  spent: string;
  refund: string;
  userBalance: string;
}

/**
 * ActivationError event data structure
 * Solidity: ActivationError(address indexed user, address indexed contractAddress, uint256 value, string reason)
 */
export interface ActivationErrorEventData extends BaseEventData {
  eventName: 'ActivationError';
  user: string;
  contractAddress: string;
  value: string;
  reason: string;
}

/**
 * ContractAutoActivateUpdated event data structure
 * Solidity: ContractAutoActivateUpdated(address indexed user, address indexed contractAddress, bool autoActivate)
 */
export interface ContractAutoActivateUpdatedEventData extends BaseEventData {
  eventName: 'ContractAutoActivateUpdated';
  user: string;
  contractAddress: string;
  autoActivate: boolean;
}

/**
 * ContractMaxActivationCostUpdated event data structure
 * Solidity: ContractMaxActivationCostUpdated(address indexed user, address indexed contractAddress, uint256 maxActivationCost)
 */
export interface ContractMaxActivationCostUpdatedEventData
  extends BaseEventData {
  eventName: 'ContractMaxActivationCostUpdated';
  user: string;
  contractAddress: string;
  maxActivationCost: string;
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
  | ContractRemovedEventData
  | ContractBiddingEnabledUpdatedEventData
  | ActivationPerformedEventData
  | ActivationErrorEventData
  | ContractAutoActivateUpdatedEventData
  | ContractMaxActivationCostUpdatedEventData
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

  isContractUpdatedEventData: (
    data: unknown[],
  ): data is [string, string, string] => {
    return (
      Array.isArray(data) &&
      data.length === 3 &&
      data.every((item) => typeof item === 'string') &&
      isValidEthereumAddress(data[0]) && // user
      isValidEthereumAddress(data[1]) && // contractAddress
      isValidPositiveNumber(data[2]) // maxBid
    );
  },

  isContractRemovedEventData: (data: unknown[]): data is [string, string] => {
    return (
      Array.isArray(data) &&
      data.length === 2 &&
      data.every((item) => typeof item === 'string') &&
      isValidEthereumAddress(data[0]) && // user
      isValidEthereumAddress(data[1]) // contractAddress
    );
  },

  isContractBiddingEnabledUpdatedEventData: (
    data: unknown[],
  ): data is [string, string, boolean] => {
    return (
      Array.isArray(data) &&
      data.length === 3 &&
      typeof data[0] === 'string' &&
      typeof data[1] === 'string' &&
      typeof data[2] === 'boolean' &&
      isValidEthereumAddress(data[0]) && // user
      isValidEthereumAddress(data[1]) // contractAddress
    );
  },

  isActivationPerformedEventData: (
    data: unknown[],
  ): data is [string, string, string, string, string, string, string] => {
    return (
      Array.isArray(data) &&
      data.length === 7 &&
      data.every((item) => typeof item === 'string') &&
      isValidEthereumAddress(data[0]) && // user
      isValidEthereumAddress(data[1]) && // contractAddress
      isValidPositiveNumber(data[2]) && // version
      isValidPositiveNumber(data[3]) && // dataFee
      isValidPositiveNumber(data[4]) && // spent
      isValidPositiveNumber(data[5]) && // refund
      isValidPositiveNumber(data[6]) // userBalance
    );
  },

  isActivationErrorEventData: (
    data: unknown[],
  ): data is [string, string, string, string] => {
    return (
      Array.isArray(data) &&
      data.length === 4 &&
      typeof data[0] === 'string' &&
      typeof data[1] === 'string' &&
      typeof data[2] === 'string' &&
      typeof data[3] === 'string' &&
      isValidEthereumAddress(data[0]) && // user
      isValidEthereumAddress(data[1]) // contractAddress
    );
  },

  isContractAutoActivateUpdatedEventData: (
    data: unknown[],
  ): data is [string, string, boolean] => {
    return (
      Array.isArray(data) &&
      data.length === 3 &&
      typeof data[0] === 'string' &&
      typeof data[1] === 'string' &&
      typeof data[2] === 'boolean' &&
      isValidEthereumAddress(data[0]) && // user
      isValidEthereumAddress(data[1]) // contractAddress
    );
  },

  isContractMaxActivationCostUpdatedEventData: (
    data: unknown[],
  ): data is [string, string, string] => {
    return (
      Array.isArray(data) &&
      data.length === 3 &&
      typeof data[0] === 'string' &&
      typeof data[1] === 'string' &&
      typeof data[2] === 'string' &&
      isValidEthereumAddress(data[0]) && // user
      isValidEthereumAddress(data[1]) && // contractAddress
      isValidPositiveNumber(data[2]) // maxActivationCost
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
