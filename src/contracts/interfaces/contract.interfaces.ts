/**
 * Shared types and interfaces for contract services
 */

import { Contract } from '../entities/contract.entity';

// TODOREFACTOR: Import this interface from the common ABI. Should not be defined here.
// Define proper types for cache manager contract
export interface CacheManagerContract {
  'getMinBid(uint64)'(size: number): Promise<bigint>;
  'getMinBid(address)'(address: string): Promise<bigint>;
  decay(): Promise<bigint>;
  getCachedBid(
    address: string,
  ): Promise<{ bid: bigint; timestamp: bigint; size: bigint }>;
  getEntries(): Promise<Array<{ code: string; size: bigint; bid: bigint }>>;
  cacheSize(): Promise<bigint>;
  queueSize(): Promise<bigint>;
}

export interface BidRiskLevels {
  highRisk: string;
  midRisk: string;
  lowRisk: string;
}

/**
 * Risk level descriptor
 */
export type RiskLevel = 'high' | 'medium' | 'low';

/**
 * Cache statistics for risk assessment
 */
export interface CacheStats {
  utilization: number; // Current cache utilization (0-1)
  evictionRate: number; // Recent eviction rate (events per day)
  medianBidPerByte: string;
  competitiveness: number; // How competitive the cache is (0-1)
  cacheSizeBytes: string;
  usedCacheSizeBytes: string;
  minBid: string; // Minimum required bid for the current request
}

// Define the result type for bid history
export type BidHistoryItem = {
  bytecodeHash: string;
  contractAddress: string;
  bid: string;
  actualBid: string;
  size: string;
  timestamp: Date;
  blockNumber: number;
  transactionHash: string;
  originAddress: string;
  isAutomated: boolean;
  automationDetails?: {
    user: string;
    minBid: string;
    maxBid: string;
    userBalance: string;
  };
};

export interface RiskMultipliers {
  highRisk: number;
  midRisk: number;
  lowRisk: number;
}

export interface ComparisonPercentages {
  vsHighRisk: number;
  vsMidRisk: number;
  vsLowRisk: number;
}

export interface EvictionRiskResult {
  riskLevel: RiskLevel;
  remainingEffectiveBid: string;
  suggestedBids: BidRiskLevels;
  comparisonPercentages: ComparisonPercentages;
  cacheStats: CacheStats;
}

export interface SuggestedBidsResult {
  suggestedBids: BidRiskLevels;
  cacheStats: CacheStats;
}

// API Response interfaces (moved from controller)
/**
 * Response interface for contract API endpoints that includes calculated fields
 */
export interface ContractResponse extends Contract {
  minBid?: string;
  effectiveBid?: string;
  evictionRisk?: EvictionRiskResult;
  suggestedBids?: SuggestedBidsResult;
  biddingHistory?: BidHistoryItem[];
  isSavedByUser?: boolean;
  savedContractName?: string | null;
}

/**
 * Response interface for suggested bids endpoints
 */
export interface SuggestedBidsResponse {
  suggestedBids: BidRiskLevels;
  cacheStats: CacheStats;
}
