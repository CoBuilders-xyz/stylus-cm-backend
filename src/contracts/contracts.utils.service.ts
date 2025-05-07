import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { BlockchainState } from '../blockchains/entities/blockchain-state.entity';
import { BlockchainEvent } from '../blockchains/entities/blockchain-event.entity';
import { ProviderManager, ContractType } from '../common/utils/provider.util';
import { Blockchain } from '../blockchains/entities/blockchain.entity';

// Define proper types for contract and provider
interface CacheManagerContract {
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

interface BidRiskLevels {
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
interface CacheStats {
  utilization: number; // Current cache utilization (0-1)
  evictionRate: number; // Recent eviction rate (events per day)
  medianBidPerByte: string;
  competitiveness: number; // How competitive the cache is (0-1)
  cacheSizeBytes: string;
  usedCacheSizeBytes: string;
  minBid: string; // Minimum required bid for the current request
}

/**
 * This service contains utility functions for processing contract data
 * and calculating derived values that need to be computed at request time.
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
  ) {}

  /**
   * Get a cache manager contract instance for a specific blockchain
   * @param blockchainId The ID of the blockchain to get the contract for
   * @returns The cache manager contract instance
   */
  private async getCacheManagerContract(
    blockchainId: string,
  ): Promise<CacheManagerContract> {
    // Get the blockchain entity
    const blockchain = await this.blockchainRepository.findOne({
      where: { id: blockchainId },
    });

    if (!blockchain) {
      throw new Error(`Blockchain with ID ${blockchainId} not found`);
    }

    // Get the contract instance from the provider manager using the CACHE_MANAGER contract type
    // Use the string literal that matches the enum value to avoid TypeScript errors
    return this.providerManager.getContract(
      blockchain,
      'cacheManager' as ContractType,
    ) as unknown as CacheManagerContract;
  }

  /**
   * Get the decay rate from blockchain events for a specific blockchain at a specific timestamp
   * @param blockchainId The ID of the blockchain to get the decay rate for
   * @param timestamp Optional timestamp to get the decay rate at, defaults to current time
   * @returns The decay rate as a string
   */
  private async getDecayRate(
    blockchainId: string,
    timestamp: Date,
  ): Promise<string> {
    try {
      // Try to find the most recent setDecayRate event before the target timestamp
      const decayRateEvent = await this.blockchainEventRepository.findOne({
        where: {
          blockchain: { id: blockchainId },
          eventName: 'SetDecayRate',
          blockTimestamp: LessThanOrEqual(timestamp),
        },
        order: { blockTimestamp: 'DESC' },
      });

      if (decayRateEvent) {
        // Parse the event data to get the decay rate
        const eventData = decayRateEvent.eventData as string[];
        // Assuming decay rate is the first parameter in the event data
        const decayRate = eventData[0];
        return decayRate;
      }

      // Fallback to checking the blockchain state if no event is found
      const latestState = await this.blockchainStateRepository.findOne({
        where: { blockchain: { id: blockchainId } },
        order: { blockNumber: 'DESC' },
      });

      if (latestState) {
        return latestState.decayRate;
      }

      this.logger.warn(
        `No decay rate information found for blockchain ${blockchainId}, using default decay rate of 0`,
      );
      return '0';
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error fetching decay rate: ${err.message}`);
      // If there's an error, return 0 as a safe default
      return '0';
    }
  }

  /**
   * Calculate the effective bid for a contract
   * Formula: lastBid - (currentTimestamp - bidBlockTimestamp) * currentDecayRate
   * Minimum value is 0
   *
   * @param contract The contract to calculate the effective bid for
   * @param decayRate Optional decay rate to use (if already fetched)
   * @returns The calculated effective bid value
   */
  calculateEffectiveBid(
    startTimestamp: Date,
    endTimestamp: Date,
    bidSize: string,
    decayRate: string,
  ): string {
    try {
      const timeElapsed = Math.floor(
        endTimestamp.getTime() / 1000 - startTimestamp.getTime() / 1000,
      );

      // Parse the values to BigInt to avoid precision issues
      const lastBidBigInt = BigInt(bidSize);
      const timeElapsedBigInt = BigInt(timeElapsed);
      const decayRateBigInt = BigInt(decayRate);

      // Calculate the decay amount
      const decayAmount = timeElapsedBigInt * decayRateBigInt;

      // Calculate the effective bid
      let effectiveBid = lastBidBigInt;

      // Only subtract if decay amount is less than the last bid
      if (decayAmount < lastBidBigInt) {
        effectiveBid = lastBidBigInt - decayAmount;
      } else {
        // If the decay amount is greater than or equal to the last bid, set to 0
        effectiveBid = BigInt(0);
      }

      return effectiveBid.toString();
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error calculating effective bid: ${err.message}`);
      // In case of an error, return 0 as a safe default
      return '0';
    }
  }

  /**
   * Calculate the effective bid for a contract
   * @param contract The contract to calculate the effective bid for
   * @returns The calculated effective bid value
   */
  async calculateCurrentContractEffectiveBid(
    contract: Contract,
  ): Promise<string> {
    const currentTimestamp = new Date();
    const decayRate = await this.getDecayRate(
      contract.blockchain.id,
      currentTimestamp,
    );
    const bidSize = contract.lastBid;
    const startTimestamp = contract.bidBlockTimestamp;
    const endTimestamp = new Date();
    return this.calculateEffectiveBid(
      startTimestamp,
      endTimestamp,
      bidSize,
      decayRate,
    );
  }

  /**
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
    try {
      // Get data from the bytecode entity directly
      const bid = BigInt(contract.bytecode.lastBid);
      const size = BigInt(contract.bytecode.size);

      // Convert the Date to a UNIX timestamp (seconds)
      const bidTimestamp = BigInt(
        Math.floor(contract.bytecode.bidBlockTimestamp.getTime() / 1000),
      );

      // Get CacheManagerContract instance for decay rate
      const cacheManagerContract = await this.getCacheManagerContract(
        contract.blockchain.id,
      );

      // Calculate effective bid (current value after decay)
      const decayRate = await cacheManagerContract.decay();
      const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
      const timeElapsed = currentTimestamp - bidTimestamp;
      const decayPenalty = decayRate * timeElapsed;
      const effectiveBid = bid > decayPenalty ? bid - decayPenalty : BigInt(0);

      // Get suggested bids for this size (what would be recommended now)
      const { suggestedBids, cacheStats } = await this.getSuggestedBids(
        Number(size),
        contract.blockchain.id,
      );

      // Parse string values back to BigInt for comparison
      const highRiskBid = BigInt(suggestedBids.highRisk);
      const midRiskBid = BigInt(suggestedBids.midRisk);
      const lowRiskBid = BigInt(suggestedBids.lowRisk);

      // Calculate percentage comparisons to each risk level
      const comparisonPercentages = {
        vsHighRisk: this.calculatePercentage(effectiveBid, highRiskBid),
        vsMidRisk: this.calculatePercentage(effectiveBid, midRiskBid),
        vsLowRisk: this.calculatePercentage(effectiveBid, lowRiskBid),
      };

      // Determine risk level based on comparison with suggested bids
      let riskLevel: RiskLevel;
      if (effectiveBid < highRiskBid) {
        // Below minimum bid - very high risk of eviction
        riskLevel = 'high';
      } else if (effectiveBid < midRiskBid) {
        // Above minimum but below mid-risk threshold
        riskLevel = 'high';
      } else if (effectiveBid < lowRiskBid) {
        // Between mid and low risk thresholds
        riskLevel = 'medium';
      } else {
        // Above low risk threshold
        riskLevel = 'low';
      }

      return {
        riskLevel,
        remainingEffectiveBid: effectiveBid.toString(),
        suggestedBids,
        comparisonPercentages,
        cacheStats,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error calculating eviction risk: ${err.message}`);

      // Return a default high-risk assessment in case of errors
      return {
        riskLevel: 'high',
        remainingEffectiveBid: '0',
        suggestedBids: {
          highRisk: BigInt(0).toString(),
          midRisk: BigInt(0).toString(),
          lowRisk: BigInt(0).toString(),
        },
        comparisonPercentages: {
          vsHighRisk: 0,
          vsMidRisk: 0,
          vsLowRisk: 0,
        },
        cacheStats: {
          utilization: 0,
          evictionRate: 0,
          medianBidPerByte: BigInt(0).toString(),
          competitiveness: 0,
          cacheSizeBytes: BigInt(0).toString(),
          usedCacheSizeBytes: BigInt(0).toString(),
          minBid: BigInt(0).toString(),
        },
      };
    }
  }

  /**
   * Get the bidding history for a contract from blockchain events
   * @param contractAddress The address of the contract to get bidding history for
   * @returns An array of bid events with parsed data
   */
  async getBiddingHistory(contractAddress: string): Promise<
    Array<{
      bytecodeHash: string;
      contractAddress: string;
      bid: string;
      actualBid: string;
      size: string;
      timestamp: Date;
      blockNumber: number;
      transactionHash: string;
      originAddress: string;
    }>
  > {
    try {
      const normalizedAddress = contractAddress.toLowerCase();

      // Try multiple query strategies to find the InsertBid events for this contract

      // First attempt: Using direct JSONB access with explicit type casting and LOWER
      const bidEvents = await this.blockchainEventRepository
        .createQueryBuilder('event')
        .leftJoinAndSelect('event.blockchain', 'blockchain')
        .select([
          'event.eventName',
          'event.blockTimestamp',
          'event.blockNumber',
          'event.transactionHash',
          'event.logIndex',
          'event.eventData',
          'event.originAddress',
          'blockchain.id',
        ])
        .where('event.eventName = :eventName', { eventName: 'InsertBid' })
        .andWhere(
          'LOWER(CAST(event."eventData"->>1 AS TEXT)) = :contractAddress',
          {
            contractAddress: normalizedAddress,
          },
        )
        .orderBy('event.blockTimestamp', 'DESC')
        .getMany();

      // Parse the event data from the primary query
      const bidPromises = bidEvents
        .map(async (event) => {
          try {
            // Extract data from the eventData array
            const eventData = event.eventData as unknown as string[];
            const [bytecodeHash, eventContractAddress, bid, size] = eventData;

            // Calculate actual bid
            const decayRate = await this.getDecayRate(
              event.blockchain.id,
              event.blockTimestamp,
            );
            const originDate = new Date(0);
            const actualBid = this.calculateEffectiveBid(
              originDate,
              event.blockTimestamp,
              bid,
              decayRate,
            );

            return {
              bytecodeHash,
              contractAddress: eventContractAddress,
              bid,
              actualBid,
              size,
              timestamp: event.blockTimestamp,
              blockNumber: event.blockNumber,
              transactionHash: event.transactionHash,
              originAddress: event.originAddress || '',
            };
          } catch (err) {
            const error = err as Error;
            this.logger.error(`Error parsing bid event data: ${error.message}`);
            return null;
          }
        })
        .filter((item) => item !== null);

      // Resolve all promises and filter out any null values
      const results = await Promise.all(bidPromises);

      // Log origin address inclusion stats
      const withOrigin = results.filter((item) => item?.originAddress).length;
      const totalItems = results.length;
      this.logger.debug(
        `Bidding history: ${withOrigin}/${totalItems} entries have origin addresses`,
      );

      return results.filter(
        (
          item,
        ): item is {
          bytecodeHash: string;
          contractAddress: string;
          bid: string;
          actualBid: string;
          size: string;
          timestamp: Date;
          blockNumber: number;
          transactionHash: string;
          originAddress: string;
        } => item !== null,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error fetching bidding history: ${err.message}`);
      return [];
    }
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
      }>;
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
    } = {
      ...contract,
    };

    // Only calculate effective bid and eviction risk if the contract is cached
    if (contract.bytecode.isCached) {
      const effectiveBid =
        await this.calculateCurrentContractEffectiveBid(contract);
      const evictionRisk = await this.calculateEvictionRisk(contract);

      processedContract = {
        ...processedContract,
        effectiveBid,
        evictionRisk,
      };
    } else {
      // If contract is not cached, only calculate suggested bids
      const size = Number(contract.bytecode.size);
      const { suggestedBids, cacheStats } = await this.getSuggestedBids(
        size,
        contract.blockchain.id,
      );

      processedContract = {
        ...processedContract,
        suggestedBids: { suggestedBids, cacheStats },
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
      }>;
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
   * Calculates suggested bids at different risk levels for a contract not yet cached
   * @param size Data size in bytes
   * @param blockchainId The ID of the blockchain to calculate suggested bids for
   * @returns Three bid levels at different risk profiles
   */
  async getSuggestedBids(
    size: number,
    blockchainId: string,
  ): Promise<{ suggestedBids: BidRiskLevels; cacheStats: CacheStats }> {
    // Get CacheManagerContract instance
    const cacheManagerContract =
      await this.getCacheManagerContract(blockchainId);

    // Get minimum bid from contract
    const minBid = await cacheManagerContract['getMinBid(uint64)'](size);
    const minBidNum = Number(minBid);
    const minBidStr = minBid.toString();

    // Get cache statistics to adjust risk multipliers
    const cacheStats = await this.getCacheStatistics(blockchainId, minBidStr);

    // Calculate dynamic risk multipliers based on cache statistics
    const riskMultipliers = this.calculateDynamicRiskMultipliers(cacheStats);

    // Calculate the risk levels based on our dynamic multipliers
    return {
      suggestedBids: {
        highRisk: minBidStr,
        midRisk: BigInt(
          Math.floor(minBidNum * riskMultipliers.midRisk),
        ).toString(),
        lowRisk: BigInt(
          Math.floor(minBidNum * riskMultipliers.lowRisk),
        ).toString(),
      },
      cacheStats,
    };
  }

  /**
   * Calculates suggested bids at different risk levels for a contract address
   * @param address Contract address
   * @param blockchainId The ID of the blockchain to calculate suggested bids for
   * @returns Three bid levels at different risk profiles
   */
  async getSuggestedBidsByAddress(
    address: string,
    blockchainId: string,
  ): Promise<{ suggestedBids: BidRiskLevels; cacheStats: CacheStats }> {
    // Get CacheManagerContract instance
    const cacheManagerContract =
      await this.getCacheManagerContract(blockchainId);

    // Get minimum bid from contract using the address variant
    const minBid = await cacheManagerContract['getMinBid(address)'](address);
    const minBidNum = Number(minBid);
    const minBidStr = minBid.toString();

    // Get cache statistics to adjust risk multipliers
    const cacheStats = await this.getCacheStatistics(blockchainId, minBidStr);

    // Calculate dynamic risk multipliers based on cache statistics
    const riskMultipliers = this.calculateDynamicRiskMultipliers(cacheStats);

    // Calculate the risk levels based on our dynamic multipliers
    return {
      suggestedBids: {
        highRisk: minBidStr,
        midRisk: BigInt(
          Math.floor(minBidNum * riskMultipliers.midRisk),
        ).toString(),
        lowRisk: BigInt(
          Math.floor(minBidNum * riskMultipliers.lowRisk),
        ).toString(),
      },
      cacheStats,
    };
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
