import { Contract } from '../../contracts/entities/contract.entity';

/**
 * Summary interface for blockchain information in responses
 */
export interface BlockchainSummary {
  id: string;
  name: string;
  chainId: number;
  enabled: boolean;
}

/**
 * Summary interface for alert information in responses
 */
export interface AlertSummary {
  id: string;
  type: string;
  isActive: boolean;
  triggeredCount: number;
  slackChannelEnabled: boolean;
  telegramChannelEnabled: boolean;
  webhookChannelEnabled: boolean;
  lastTriggered?: Date;
  value?: string;
}

/**
 * Enhanced contract interface with processed data
 */
export interface EnrichedContract extends Contract {
  evictionRisk?: {
    riskLevel: string;
    remainingEffectiveBid: string;
    suggestedBids: {
      conservative: string;
      moderate: string;
      aggressive: string;
    };
  };
  biddingHistory?: Array<{
    bytecodeHash: string;
    contractAddress: string;
    bid: string;
    actualBid: string;
    size: string;
    timestamp: string;
    blockNumber: string;
    transactionHash: string;
    originAddress: string;
    isAutomated?: boolean;
    automationDetails?: {
      user: string;
      minBid: string;
      maxBid: string;
      userBalance: string;
    };
  }>;
}

/**
 * Main user contract response interface
 */
export interface UserContractResponse {
  id: string;
  address: string;
  name: string;
  blockchain: BlockchainSummary;
  contract?: EnrichedContract;
  alerts?: AlertSummary[];
}

/**
 * Pagination metadata for paginated responses
 */
export interface PaginationMetadata {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Paginated user contracts response
 */
export interface UserContractsPaginatedResponse {
  data: UserContractResponse[];
  meta: PaginationMetadata;
}

/**
 * Response for checking if contracts are saved by user
 */
export type ContractSavedStatusResponse = {
  [contractId: string]: boolean;
};

/**
 * Response for user contract creation
 */
export interface CreateUserContractResponse extends UserContractResponse {
  // Inherits all properties from UserContractResponse
  // Could add creation-specific fields if needed
}

/**
 * Response for user contract name update
 */
export interface UpdateUserContractNameResponse {
  id: string;
  name: string;
  message: string;
}
