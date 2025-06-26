import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { BlockchainState } from '../../blockchains/entities/blockchain-state.entity';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { ContractBidCalculatorService } from './contract-bid-calculator.service';
import { CacheStats } from '../interfaces/contract.interfaces';

/**
 * Service responsible for cache statistics analysis and calculations.
 * This service handles all logic related to cache performance metrics and analysis.
 */
@Injectable()
export class CacheStatisticsService {
  // Base risk multipliers that will be adjusted based on cache usage
  private readonly BASE_HIGH_RISK_MULTIPLIER = 1.0; // Minimum viable bid
  private readonly BASE_MID_RISK_MULTIPLIER = 1.5; // Better chance of staying cached
  private readonly BASE_LOW_RISK_MULTIPLIER = 2.5; // Very likely to stay cached

  // Cache analysis timeframe (in days)
  private readonly ANALYSIS_PERIOD_DAYS = 7;
  private readonly logger = new Logger(CacheStatisticsService.name);

  constructor(
    @InjectRepository(BlockchainState)
    private readonly blockchainStateRepository: Repository<BlockchainState>,
    @InjectRepository(BlockchainEvent)
    private readonly blockchainEventRepository: Repository<BlockchainEvent>,
    @InjectRepository(Blockchain)
    private readonly blockchainRepository: Repository<Blockchain>,
    private readonly bidCalculatorService: ContractBidCalculatorService,
  ) {}

  /**
   * Calculate dynamic risk multipliers based on cache statistics
   * @param stats Cache usage statistics
   * @returns Object with adjusted risk multipliers
   */
  calculateDynamicRiskMultipliers(stats: CacheStats): {
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
  async getCacheStatistics(
    blockchainId: string,
    minBid: string = '0',
  ): Promise<CacheStats> {
    // Get CacheManagerContract instance
    const cacheManagerContract =
      await this.bidCalculatorService.getCacheManagerContract(blockchainId);

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
  calculatePercentage(value: bigint, baseline: bigint): number {
    if (baseline === BigInt(0)) return 0;

    // To maintain precision with BigInt division, multiply first then divide
    // Using a higher multiplier (10000) for greater precision before converting to Number
    const multiplier = BigInt(10000);
    const rawPercentage = (value * multiplier * BigInt(100)) / baseline;

    // Convert to number and divide by the multiplier to get the actual percentage
    return Number(rawPercentage) / Number(multiplier);
  }
}
