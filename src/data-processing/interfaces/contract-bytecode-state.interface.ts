/**
 * Represents the state of a contract bytecode in the cache manager system.
 * Used to track contract bytecode state during event processing.
 */
export interface ContractBytecodeState {
  isCached: boolean;
  bid: string;
  bidPlusDecay: string;
  size: number;
  totalBidInvestment: string;
  lastEvictionBid?: string;
  address?: string;
  name?: string;
  lastEventBlock?: number;
  lastEventName?: string;
}
