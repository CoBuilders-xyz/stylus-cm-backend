import { ICacheManagerAutomationV2 } from 'src/common/types/contracts/cacheManagerAutomation/CacheManagerAutomation';

export interface SelectedContract {
  user: string;
  address: string;
}

export interface ContractSelectionCriteria {
  minBid: bigint;
  maxBid: bigint;
  contractAddress: string;
  enabled: boolean;
}

export interface ContractSelectionResult {
  selectedContracts: SelectedContract[];
  totalProcessed: number;
  totalEligible: number;
  skippedReasons: {
    disabled: number;
    bidTooHigh: number;
    alreadyCached: number;
    fetchError: number;
  };
}

export interface AutomatedUserConfig {
  user: string;
  contracts: ContractSelectionCriteria[];
}

export interface ContractCodeAnalysis {
  contractAddress: string;
  codeHash: string;
  isCached: boolean;
  codeSize: number;
}

export interface BidAssessment {
  contractAddress: string;
  minBid: bigint;
  maxBid: bigint;
  isEligible: boolean;
  reason?: string;
}

export interface ContractSelectionOptions {
  batchSize?: number;
  paginationLimit?: number;
  skipCacheCheck?: boolean;
  includeAnalysis?: boolean;
}

export type UserContractsData =
  ICacheManagerAutomationV2.UserContractsDataStructOutput;
