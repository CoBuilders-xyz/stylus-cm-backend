import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { BlockchainState } from '../blockchains/entities/blockchain-state.entity';
import { BlockchainEvent } from '../blockchains/entities/blockchain-event.entity';
import { ProviderManager } from '../common/utils/provider.util';
import { Blockchain } from '../blockchains/entities/blockchain.entity';
import { ContractBidCalculatorService } from './services/contract-bid-calculator.service';
import { ContractBidAssessmentService } from './services/contract-bid-assessment.service';
import { ContractHistoryService } from './services/contract-history.service';
import {
  CacheManagerContract,
  BidRiskLevels,
  RiskLevel,
  CacheStats,
  BidHistoryItem,
} from './interfaces/contract.interfaces';

/**
 * This service contains utility functions for processing contract data
 * and calculating derived values that need to be computed at request time.
 *
 * NOTE: This service is being refactored to extract responsibilities into focused services.
 * Many methods now delegate to specialized services.
 */
@Injectable()
export class ContractsUtilsService {
  // Base risk multipliers that will be adjusted based on cache usage
  private readonly BASE_HIGH_RISK_MULTIPLIER = 1.0; // Minimum viable bid
  private readonly BASE_MID_RISK_MULTIPLIER = 1.5; // Better chance of staying cached
  private readonly BASE_LOW_RISK_MULTIPLIER = 2.5; // Very likely to stay cached

  // Cache analysis timeframe (in days)
  private readonly ANALYSIS_PERIOD_DAYS = 7;
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
  ) {}

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
      biddingHistory?: Array<{
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
      }>;
      minBid: string;
    }
  > {
    let processedContract: Contract & {
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
      minBid: string;
    } = {
      ...contract,
      minBid: '0',
    };

    // Only calculate effective bid and eviction risk if the contract is cached
    if (contract.bytecode.isCached) {
      const effectiveBid =
        await this.calculateCurrentContractEffectiveBid(contract);
      const evictionRisk =
        await this.bidAssessmentService.calculateEvictionRisk(contract);

      processedContract = {
        ...processedContract,
        effectiveBid,
        evictionRisk,
        minBid: evictionRisk.cacheStats.minBid,
      };
    } else {
      // If contract is not cached, only calculate suggested bids
      const size = Number(contract.bytecode.size);
      const { suggestedBids, cacheStats } =
        await this.bidAssessmentService.getSuggestedBids(
          size,
          contract.blockchain.id,
        );

      processedContract = {
        ...processedContract,
        suggestedBids: { suggestedBids, cacheStats },
        minBid: cacheStats.minBid,
      };
    }

    // Optionally include bidding history if requested
    if (includeBiddingHistory) {
      return {
        ...processedContract,
        biddingHistory: await this.getBiddingHistory(contract.address),
      };
    }

    return processedContract;
  }

  /**
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
      biddingHistory?: Array<{
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
      }>;
      minBid: string;
    })[]
  > {
    if (contracts.length === 0) {
      return [];
    }

    // Process all contracts in parallel using Promise.all
    const processedContracts = await Promise.all(
      contracts.map((contract) =>
        this.processContract(contract, includeBiddingHistory),
      ),
    );

    return processedContracts;
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
   * Calculate dynamic risk multipliers based on cache statistics
   * @param stats Cache usage statistics
   * @returns Object with adjusted risk multipliers
   */
  private calculateDynamicRiskMultipliers(stats: CacheStats): {
    highRisk: number;
    midRisk: number;
    lowRisk: number;
  } {
    // 1. Adjust for cache utilization
    // As utilization increases, risk multipliers should increase
    const utilizationFactor = 1 + stats.utilization;

    // 2. Adjust for eviction rate
    // Higher eviction rate means more competition, so increase multipliers
    // Normalize eviction rate to a factor between 1-1.5
    const evictionFactor = 1 + Math.min(stats.evictionRate / 10, 0.5);

    // 3. Adjust for cache competitiveness
    // More competitive cache requires higher bids
    const competitivenessFactor = 1 + stats.competitiveness;

    // Combine factors with different weights
    // These weights can be tuned based on observed importance of each factor
    const combinedAdjustment =
      utilizationFactor * 0.5 +
      evictionFactor * 0.3 +
      competitivenessFactor * 0.2;

    // Apply the combined adjustment to base multipliers
    // Keep highRisk at 1.0 (minimum bid) but adjust others
    return {
      highRisk: this.BASE_HIGH_RISK_MULTIPLIER,
      midRisk: this.BASE_MID_RISK_MULTIPLIER * combinedAdjustment,
      lowRisk: this.BASE_LOW_RISK_MULTIPLIER * combinedAdjustment,
    };
  }

  /**
   * Gather cache statistics by analyzing contract state and blockchain events
   * @param blockchainId The ID of the blockchain to gather cache statistics for
   * @param minBid Optional minimum bid to include in the statistics
   * @returns Cache statistics for risk assessment
   */
  private async getCacheStatistics(
    blockchainId: string,
    minBid: string = '0',
  ): Promise<CacheStats> {
    // Get CacheManagerContract instance
    const cacheManagerContract =
      await this.getCacheManagerContract(blockchainId);

    // Get cache size information directly from contract
    const totalCacheSize = await cacheManagerContract.cacheSize();
    const usedCacheSize = await cacheManagerContract.queueSize();

    // Get entries only for calculating bid per byte distribution
    const entries = await cacheManagerContract.getEntries();
    const bidsPerByte: bigint[] = [];

    for (const entry of entries) {
      if (entry.size > 0) {
        // Calculate bid per byte for distribution analysis
        const bidPerByte = entry.size > 0 ? entry.bid / entry.size : BigInt(0);
        bidsPerByte.push(bidPerByte);
      }
    }

    // Calculate cache utilization ratio
    const utilization =
      totalCacheSize > 0
        ? Number((usedCacheSize * BigInt(100)) / totalCacheSize) / 100
        : 0;

    // Get eviction events from the last analysis period
    const eventsTimeCutoff = new Date();
    eventsTimeCutoff.setDate(
      eventsTimeCutoff.getDate() - this.ANALYSIS_PERIOD_DAYS,
    );

    const recentEvictionEvents = await this.blockchainEventRepository.find({
      where: {
        eventName: 'DeleteBid',
        blockchain: { id: blockchainId },
        blockTimestamp: MoreThanOrEqual(eventsTimeCutoff),
      },
      order: {
        blockTimestamp: 'DESC',
      },
    });

    // Calculate eviction rate (evictions per day)
    const evictionRate =
      recentEvictionEvents.length / this.ANALYSIS_PERIOD_DAYS;

    // Calculate median bid per byte
    let medianBidPerByte = BigInt(0);
    if (bidsPerByte.length > 0) {
      bidsPerByte.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      const midIndex = Math.floor(bidsPerByte.length / 2);
      medianBidPerByte =
        bidsPerByte.length % 2 === 0
          ? (bidsPerByte[midIndex - 1] + bidsPerByte[midIndex]) / BigInt(2)
          : bidsPerByte[midIndex];
    }

    // Calculate cache competitiveness based on eviction rate and utilization
    // Higher values mean more competition for cache space
    const competitiveness = Math.min(
      (evictionRate / 5) * utilization, // Normalize to 0-1 range
      1, // Cap at 1
    );

    return {
      utilization,
      evictionRate,
      medianBidPerByte: medianBidPerByte.toString(),
      competitiveness,
      cacheSizeBytes: totalCacheSize.toString(),
      usedCacheSizeBytes: usedCacheSize.toString(),
      minBid,
    };
  }

  /**
   * Helper method to calculate percentage of one bigint relative to another
   * @param value The value to compare
   * @param baseline The baseline to compare against
   * @returns Percentage as a number
   */
  private calculatePercentage(value: bigint, baseline: bigint): number {
    if (baseline === BigInt(0)) return 0;

    // To maintain precision with BigInt division, multiply first then divide
    // Using a higher multiplier (10000) for greater precision before converting to Number
    const multiplier = BigInt(10000);
    const rawPercentage = (value * multiplier * BigInt(100)) / baseline;

    // Convert to number and divide by the multiplier to get the actual percentage
    return Number(rawPercentage) / Number(multiplier);
  }
}
