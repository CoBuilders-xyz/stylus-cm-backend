import { Injectable, Logger } from '@nestjs/common';
import {
  BlockchainCrudService,
  BlockchainMetricsService,
  BlockchainAnalyticsService,
} from './services';
import { TimespanType, ContractSizeRange } from './constants';
import { BidAverageDto } from './dto';

@Injectable()
export class BlockchainsService {
  private readonly logger = new Logger(BlockchainsService.name);

  constructor(
    private readonly crudService: BlockchainCrudService,
    private readonly metricsService: BlockchainMetricsService,
    private readonly analyticsService: BlockchainAnalyticsService,
  ) {}

  /**
   * Find all enabled blockchains
   */
  async findAll() {
    return this.crudService.findAll();
  }

  /**
   * Get comprehensive blockchain data for dashboard
   */
  async getBlockchainData(blockchainId: string) {
    try {
      this.logger.log(
        `Getting comprehensive blockchain data for: ${blockchainId}`,
      );

      // Get bytecode trends first (needed for metrics calculation)
      const netBytecodesTrends =
        await this.analyticsService.getNetBytecodesTrends({
          blockchainId,
          timespan: TimespanType.MONTHLY,
        });

      // Get all data in parallel
      const [
        bytecodeStatsWithTrends,
        cacheStats,
        bidPlacementTrends,
        bidPlacementTrendsWeek,
        bidPlacementTrendsMonth,
        bidPlacementTrendsYear,
        averageBidAll,
        averageBidSmall,
        averageBidMedium,
        averageBidLarge,
      ] = await Promise.all([
        this.metricsService.getTotalBytecodesWithTrends(
          blockchainId,
          netBytecodesTrends,
        ),
        this.metricsService.getCacheStats(blockchainId),
        this.analyticsService.getBidPlacementTrends({
          blockchainId,
          timespan: TimespanType.DAILY,
        }),
        this.analyticsService.getBidPlacementTrends({
          blockchainId,
          timespan: TimespanType.WEEKLY,
        }),
        this.analyticsService.getBidPlacementTrends({
          blockchainId,
          timespan: TimespanType.MONTHLY,
        }),
        this.analyticsService.getBidPlacementTrends({
          blockchainId,
          timespan: TimespanType.YEARLY,
        }),
        this.analyticsService.getAverageBid({
          blockchainId,
          timespan: TimespanType.DAILY,
        }),
        this.analyticsService.getAverageBid({
          blockchainId,
          timespan: TimespanType.DAILY,
          maxSize: ContractSizeRange.SMALL_MAX,
          minSize: 0,
        }),
        this.analyticsService.getAverageBid({
          blockchainId,
          timespan: TimespanType.DAILY,
          maxSize: ContractSizeRange.MEDIUM_MAX,
          minSize: ContractSizeRange.SMALL_MAX,
        }),
        this.analyticsService.getAverageBid({
          blockchainId,
          timespan: TimespanType.DAILY,
          minSize: ContractSizeRange.MEDIUM_MAX,
        }),
      ]);

      const result = {
        bytecodeCount: bytecodeStatsWithTrends.bytecodeCount,
        bytecodeCountDiffWithLastPeriod:
          bytecodeStatsWithTrends.bytecodeCountDiffWithLastPeriod,
        queueSize: cacheStats.queueSize,
        cacheSize: cacheStats.cacheSize,
        bidPlacementTrends,
        bidPlacementTrendsWeek,
        bidPlacementTrendsMonth,
        bidPlacementTrendsYear,
        netBytecodesTrends,
        averageBids: {
          all: averageBidAll,
          small: averageBidSmall, // 0-800KB
          medium: averageBidMedium, // 800-1600KB
          large: averageBidLarge, // >1600KB
        },
      };

      this.logger.log(
        `Comprehensive blockchain data retrieved for: ${blockchainId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error getting blockchain data for: ${blockchainId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get total bytecodes for a blockchain
   */
  async getTotalBytecodes(blockchainId: string) {
    try {
      this.logger.log(
        `Getting total bytecodes for blockchain: ${blockchainId}`,
      );

      const netBytecodesTrends =
        await this.analyticsService.getNetBytecodesTrends({
          blockchainId,
          timespan: TimespanType.MONTHLY,
        });

      const result = await this.metricsService.getTotalBytecodesWithTrends(
        blockchainId,
        netBytecodesTrends,
      );

      this.logger.log(
        `Total bytecodes retrieved for blockchain: ${blockchainId}`,
      );
      return {
        bytecodeCount: result.bytecodeCount,
        bytecodeCountDiffWithLastMonth: result.bytecodeCountDiffWithLastPeriod,
      };
    } catch (error) {
      this.logger.error(
        `Error getting total bytecodes for blockchain: ${blockchainId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get cache statistics for a blockchain
   */
  async getCacheStats(blockchainId: string) {
    return this.metricsService.getCacheStats(blockchainId);
  }

  /**
   * Get bid placement trends for a blockchain
   */
  async getBidPlacementTrends(timespan: string, blockchainId: string) {
    // Convert string timespan to enum for validation
    const timespanEnum = timespan as TimespanType;
    return this.analyticsService.getBidPlacementTrends({
      blockchainId,
      timespan: timespanEnum,
    });
  }

  /**
   * Get average bid for a blockchain with optional size filtering
   */
  async getAverageBid(
    timespan: string,
    blockchainId: string,
    maxSizeKB: number = 0,
    minSizeKB: number = 0,
  ) {
    // Convert string timespan to enum for validation
    const timespanEnum = timespan as TimespanType;
    const dto: BidAverageDto = {
      blockchainId,
      timespan: timespanEnum,
      maxSize: maxSizeKB > 0 ? maxSizeKB : undefined,
      minSize: minSizeKB > 0 ? minSizeKB : undefined,
    };

    return this.analyticsService.getAverageBid(dto);
  }
}
