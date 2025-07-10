/**
 * Internal interfaces for blockchain module implementation
 * These are not exposed publicly and are used for internal service operations
 */

/**
 * Raw query result interface for bid placement trend queries
 */
export interface BidPlacementQueryResult {
  period: string;
  count: string;
}

/**
 * Raw query result interface for net bytecode trend queries
 */
export interface NetBytecodeQueryResult {
  period: string;
  eventName: string;
  count: string;
}

/**
 * Raw query result interface for average bid calculation queries
 */
export interface AverageBidQueryResult {
  id: string;
  blockNumber: number;
  blockTimestamp: string;
  eventData: any[];
  period: string;
  logIndex?: number;
}

/**
 * Internal data structure for period-based calculations
 */
export interface PeriodData {
  insertCount: number;
  deleteCount: number;
}

/**
 * Configuration interface for blockchain upsert operations
 */
export interface BlockchainUpsertResult {
  operation: 'inserted' | 'updated';
  blockchain: {
    name: string;
    chainId: number;
    enabled: boolean;
  };
}
