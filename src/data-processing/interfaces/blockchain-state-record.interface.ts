/**
 * Represents a snapshot of blockchain state at a specific point in time.
 * Used to track and retrieve blockchain configuration parameters.
 */
export interface BlockchainStateRecord {
  id: number;
  blockchainId: string;
  minBid: string;
  decayRate: string;
  cacheSize: string;
  queueSize: string;
  isPaused: boolean;
  totalContractsCached?: string;
  blockNumber: number;
  blockTimestamp: Date;
  timestamp: Date;
}
