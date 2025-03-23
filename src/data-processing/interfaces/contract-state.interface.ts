/**
 * Represents the state of a contract in the cache manager system.
 * Used to track contract state during event processing.
 */
export interface ContractState {
  isCached: boolean;
  bid: number;
  bidPlusDecay: number;
  lastEvictionBid?: number;
  size: number;
  address?: string;
  name?: string;
  lastEventBlock?: number;
  lastEventName?: string;
  totalBidInvestment: number;
}
