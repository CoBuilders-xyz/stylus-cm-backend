import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { BlockchainState } from '../blockchains/entities/blockchain-state.entity';
import { BlockchainEvent } from '../blockchains/entities/blockchain-event.entity';
import { ProviderManager } from '../common/utils/provider.util';
import { Blockchain } from '../blockchains/entities/blockchain.entity';
import { ContractBidCalculatorService } from './services/contract-bid-calculator.service';
import { ContractBidAssessmentService } from './services/contract-bid-assessment.service';
import { ContractHistoryService } from './services/contract-history.service';
import { ContractEnrichmentService } from './services/contract-enrichment.service';
import { CacheStatisticsService } from './services/cache-statistics.service';
import {
  CacheManagerContract,
  BidRiskLevels,
  RiskLevel,
  CacheStats,
  BidHistoryItem,
} from './interfaces/contract.interfaces';

// TODOREFACTOR: This file is deprecated. only kept until other services are updated.

/**
 * This service contains utility functions for processing contract data
 * and calculating derived values that need to be computed at request time.
 *
 * NOTE: This service has been refactored to extract responsibilities into focused services.
 * All methods now delegate to specialized services and are marked as deprecated.
 * This service will be removed in a future version.
 */
@Injectable()
export class ContractsUtilsService {
  private readonly logger = new Logger(ContractsUtilsService.name);
  private readonly providerManager = new ProviderManager();

  constructor(
    @InjectRepository(BlockchainState)
    private readonly blockchainStateRepository: Repository<BlockchainState>,
    @InjectRepository(BlockchainEvent)
    private readonly blockchainEventRepository: Repository<BlockchainEvent>,
    @InjectRepository(Blockchain)
    private readonly blockchainRepository: Repository<Blockchain>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    private readonly bidCalculatorService: ContractBidCalculatorService,
    private readonly bidAssessmentService: ContractBidAssessmentService,
    private readonly historyService: ContractHistoryService,
    private readonly enrichmentService: ContractEnrichmentService,
    private readonly cacheStatisticsService: CacheStatisticsService,
  ) {}

  /**
   * @deprecated Use ContractBidCalculatorService.calculateEffectiveBid() instead
   * Calculate the effective bid for a contract
   * Formula: lastBid - (currentTimestamp - bidBlockTimestamp) * currentDecayRate
   * Minimum value is 0
   *
   * @param startTimestamp The timestamp when the bid was placed
   * @param endTimestamp The current timestamp to calculate against
   * @param bidSize The original bid amount
   * @param decayRate The decay rate to apply
   * @returns The calculated effective bid value
   */
  calculateEffectiveBid(
    startTimestamp: Date,
    endTimestamp: Date,
    bidSize: string,
    decayRate: string,
  ): string {
    return this.bidCalculatorService.calculateEffectiveBid(
      startTimestamp,
      endTimestamp,
      bidSize,
      decayRate,
    );
  }

  /**
   * @deprecated Use ContractBidCalculatorService.calculateCurrentContractEffectiveBid() instead
   * Calculate the effective bid for a contract
   * @param contract The contract to calculate the effective bid for
   * @returns The calculated effective bid value
   */
  async calculateCurrentContractEffectiveBid(
    contract: Contract,
  ): Promise<string> {
    return this.bidCalculatorService.calculateCurrentContractEffectiveBid(
      contract,
    );
  }

  /**
   * @deprecated Use ContractBidAssessmentService.calculateEvictionRisk() instead
   * Calculate the eviction risk for a contract
   * @param contract The contract to calculate the eviction risk for
   * @returns The calculated eviction risk value (could be a percentage or score)
   */
  async calculateEvictionRisk(contract: Contract): Promise<{
    riskLevel: RiskLevel;
    remainingEffectiveBid: string;
    suggestedBids: BidRiskLevels;
    comparisonPercentages: {
      vsHighRisk: number;
      vsMidRisk: number;
      vsLowRisk: number;
    };
    cacheStats: CacheStats;
  }> {
    return this.bidAssessmentService.calculateEvictionRisk(contract);
  }

  /**
   * @deprecated Use ContractHistoryService.getBiddingHistory() instead
   * Get the bidding history for a contract from blockchain events
   * @param contractAddress The address of the contract to get bidding history for
   * @returns An array of bid events with parsed data
   */
  async getBiddingHistory(contractAddress: string): Promise<BidHistoryItem[]> {
    return this.historyService.getBiddingHistory(contractAddress);
  }

  /**
   * @deprecated Use ContractEnrichmentService.processContract() instead
   * Process a contract to add calculated fields
   * @param contract The contract to process
   * @param includeBiddingHistory Optional flag to include bidding history (default: false)
   * @returns The contract with additional calculated fields
   */
  async processContract(
    contract: Contract,
    includeBiddingHistory = false,
  ): Promise<
    Contract & {
      minBid: string;
      effectiveBid?: string;
      evictionRisk?: {
        riskLevel: RiskLevel;
        remainingEffectiveBid: string;
        suggestedBids: BidRiskLevels;
        comparisonPercentages: {
          vsHighRisk: number;
          vsMidRisk: number;
          vsLowRisk: number;
        };
        cacheStats: CacheStats;
      };
      suggestedBids?: {
        suggestedBids: BidRiskLevels;
        cacheStats: CacheStats;
      };
      biddingHistory?: BidHistoryItem[];
    }
  > {
    return this.enrichmentService.processContract(
      contract,
      includeBiddingHistory,
    );
  }

  /**
   * @deprecated Use ContractEnrichmentService.processContracts() instead
   * Process an array of contracts to add calculated fields to each one
   * @param contracts The array of contracts to process
   * @param includeBiddingHistory Optional flag to include bidding history (default: false)
   * @returns The processed contracts with additional calculated fields
   */
  async processContracts(
    contracts: Contract[],
    includeBiddingHistory = false,
  ): Promise<
    (Contract & {
      minBid: string;
      effectiveBid?: string;
      evictionRisk?: {
        riskLevel: RiskLevel;
        remainingEffectiveBid: string;
        suggestedBids: BidRiskLevels;
        comparisonPercentages: {
          vsHighRisk: number;
          vsMidRisk: number;
          vsLowRisk: number;
        };
        cacheStats: CacheStats;
      };
      suggestedBids?: {
        suggestedBids: BidRiskLevels;
        cacheStats: CacheStats;
      };
      biddingHistory?: BidHistoryItem[];
    })[]
  > {
    return this.enrichmentService.processContracts(
      contracts,
      includeBiddingHistory,
    );
  }

  /**
   * @deprecated Use ContractBidAssessmentService.getSuggestedBids() instead
   * Calculates suggested bids at different risk levels for a contract not yet cached
   * @param size Data size in bytes
   * @param blockchainId The ID of the blockchain to calculate suggested bids for
   * @returns Three bid levels at different risk profiles
   */
  async getSuggestedBids(
    size: number,
    blockchainId: string,
  ): Promise<{ suggestedBids: BidRiskLevels; cacheStats: CacheStats }> {
    return this.bidAssessmentService.getSuggestedBids(size, blockchainId);
  }

  /**
   * @deprecated Use ContractBidAssessmentService.getSuggestedBidsByAddress() instead
   * Calculates suggested bids at different risk levels for a contract address
   * @param address Contract address
   * @param blockchainId The ID of the blockchain to calculate suggested bids for
   * @returns Three bid levels at different risk profiles
   */
  async getSuggestedBidsByAddress(
    address: string,
    blockchainId: string,
  ): Promise<{ suggestedBids: BidRiskLevels; cacheStats: CacheStats }> {
    return this.bidAssessmentService.getSuggestedBidsByAddress(
      address,
      blockchainId,
    );
  }

  /**
   * @deprecated Use ContractBidCalculatorService.getCacheManagerContract() instead
   * Get a cache manager contract instance for a specific blockchain
   * @param blockchainId The ID of the blockchain to get the contract for
   * @returns The cache manager contract instance
   */
  private async getCacheManagerContract(
    blockchainId: string,
  ): Promise<CacheManagerContract> {
    return this.bidCalculatorService.getCacheManagerContract(blockchainId);
  }

  /**
   * @deprecated Use ContractBidCalculatorService.getDecayRate() instead
   * Get the decay rate from blockchain events for a specific blockchain at a specific timestamp
   * @param blockchainId The ID of the blockchain to get the decay rate for
   * @param timestamp Optional timestamp to get the decay rate at, defaults to current time
   * @returns The decay rate as a string
   */
  private async getDecayRate(
    blockchainId: string,
    timestamp: Date,
  ): Promise<string> {
    return this.bidCalculatorService.getDecayRate(blockchainId, timestamp);
  }
}
