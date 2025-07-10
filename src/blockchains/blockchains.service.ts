import { Injectable } from '@nestjs/common';
import {
  BlockchainCrudService,
  BlockchainMetricsService,
  BlockchainAnalyticsService,
} from './services';
import { TimespanType, ContractSizeRange, MODULE_NAME } from './constants';
import { BidAverageDto } from './dto';
import {
  BlockchainDataResponse,
  BytecodeStatsResponse,
  CacheStatsResponse,
  BidTrendsResponse,
  AverageBidResponse,
} from './interfaces';
import { Blockchain } from './entities/blockchain.entity';
import { createModuleLogger } from '../common/utils/logger.util';

@Injectable()
export class BlockchainsService {
  private readonly logger = createModuleLogger(BlockchainsService, MODULE_NAME);

  constructor(
    private readonly crudService: BlockchainCrudService,
    private readonly metricsService: BlockchainMetricsService,
    private readonly analyticsService: BlockchainAnalyticsService,
  ) {}

  /**
   * Find all enabled blockchains
   */
  async findAll(): Promise<Blockchain[]> {
    this.logger.debug('Fetching all enabled blockchains');
    const blockchains = await this.crudService.findAll();
    this.logger.log(`Retrieved ${blockchains.length} enabled blockchains`);
    return blockchains;
  }

  /**
   * Get comprehensive blockchain data for dashboard
   */
  async getBlockchainData(
    blockchainId: string,
  ): Promise<BlockchainDataResponse> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Starting comprehensive data fetch for blockchain: ${blockchainId}`,
      );

      // Get bytecode trends first (needed for metrics calculation)
      this.logger.debug(
        `Fetching net bytecode trends for blockchain: ${blockchainId}`,
      );
      const netBytecodesTrends =
        await this.analyticsService.getNetBytecodesTrends({
          blockchainId,
          timespan: TimespanType.MONTHLY,
        });

      this.logger.debug(
        `Starting parallel data fetch for ${9} operations for blockchain: ${blockchainId}`,
      );

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

      this.logger.debug(
        `Assembling comprehensive response for blockchain: ${blockchainId}`,
      );

      const result: BlockchainDataResponse = {
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

      const duration = Date.now() - startTime;
      this.logger.log(
        `Comprehensive blockchain data retrieved for: ${blockchainId} (${duration}ms)`,
      );
      this.logger.debug(
        `Response summary - Bytecodes: ${result.bytecodeCount}, Cache: ${((Number(result.queueSize) / Number(result.cacheSize)) * 100).toFixed(1)}% full, Total bids: ${result.averageBids.all.global.count}`,
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error as Error;
      this.logger.error(
        `Failed to get comprehensive blockchain data for: ${blockchainId} after ${duration}ms: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Get total bytecodes for a blockchain
   */
  async getTotalBytecodes(
    blockchainId: string,
  ): Promise<BytecodeStatsResponse> {
    try {
      this.logger.debug(
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

      const response = {
        bytecodeCount: result.bytecodeCount,
        bytecodeCountDiffWithLastMonth: result.bytecodeCountDiffWithLastPeriod,
      };

      this.logger.log(
        `Total bytecodes retrieved for blockchain ${blockchainId}: ${response.bytecodeCount} (${response.bytecodeCountDiffWithLastMonth > 0 ? '+' : ''}${response.bytecodeCountDiffWithLastMonth} vs last month)`,
      );

      return response;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get total bytecodes for blockchain ${blockchainId}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Get cache statistics for a blockchain
   */
  async getCacheStats(blockchainId: string): Promise<CacheStatsResponse> {
    this.logger.debug(
      `Delegating cache stats request for blockchain: ${blockchainId}`,
    );
    return this.metricsService.getCacheStats(blockchainId);
  }

  /**
   * Get bid placement trends for a blockchain
   */
  async getBidPlacementTrends(
    timespan: string,
    blockchainId: string,
  ): Promise<BidTrendsResponse> {
    this.logger.debug(
      `Getting bid placement trends for blockchain ${blockchainId} with timespan: ${timespan}`,
    );

    // Convert string timespan to enum for validation
    const timespanEnum = timespan as TimespanType;
    const result = await this.analyticsService.getBidPlacementTrends({
      blockchainId,
      timespan: timespanEnum,
    });

    this.logger.log(
      `Bid placement trends retrieved for blockchain ${blockchainId} (${timespan}): ${result.global.insertCount} inserts, ${result.global.deleteCount} deletes, ${result.global.netChange} net change across ${result.periods.length} periods`,
    );

    return result;
  }

  /**
   * Get average bid for a blockchain with optional size filtering
   */
  async getAverageBid(
    timespan: string,
    blockchainId: string,
    maxSizeKB: number = 0,
    minSizeKB: number = 0,
  ): Promise<AverageBidResponse> {
    const sizeFilter =
      maxSizeKB > 0 || minSizeKB > 0
        ? ` with size filter: ${minSizeKB || 0}-${maxSizeKB || '∞'}KB`
        : '';
    this.logger.debug(
      `Getting average bid for blockchain ${blockchainId} (${timespan})${sizeFilter}`,
    );

    // Convert string timespan to enum for validation
    const timespanEnum = timespan as TimespanType;
    const dto: BidAverageDto = {
      blockchainId,
      timespan: timespanEnum,
      maxSize: maxSizeKB > 0 ? maxSizeKB : undefined,
      minSize: minSizeKB > 0 ? minSizeKB : undefined,
    };

    const result = await this.analyticsService.getAverageBid(dto);

    this.logger.log(
      `Average bid retrieved for blockchain ${blockchainId} (${timespan})${sizeFilter}: ${result.global.parsedAverageBid} ETH (${result.global.count} bids)`,
    );

    return result;
  }
}
