import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockchainState } from '../entities/blockchain-state.entity';
import { Bytecode } from '../../contracts/entities/bytecode.entity';
import { BlockchainsErrorHelpers } from '../blockchains.errors';
import { BlockchainCrudService } from './blockchain-crud.service';
import { UNIT_CONVERSIONS, MODULE_NAME } from '../constants';
import {
  CacheStatsResponse,
  BytecodeStatsResponse,
  BytecodeStatsWithTrendsResponse,
} from '../interfaces';
import { createModuleLogger } from '../../common/utils/logger.util';

@Injectable()
export class BlockchainMetricsService {
  private readonly logger = createModuleLogger(
    BlockchainMetricsService,
    MODULE_NAME,
  );

  constructor(
    @InjectRepository(BlockchainState)
    private readonly blockchainStateRepository: Repository<BlockchainState>,
    @InjectRepository(Bytecode)
    private readonly bytecodeRepository: Repository<Bytecode>,
    private readonly blockchainCrudService: BlockchainCrudService,
  ) {}

  /**
   * Get cache statistics for a blockchain
   */
  async getCacheStats(blockchainId: string): Promise<CacheStatsResponse> {
    try {
      this.logger.debug(
        `Getting cache statistics for blockchain: ${blockchainId}`,
      );

      const blockchainState = await this.blockchainStateRepository.findOne({
        where: { blockchain: { id: blockchainId } },
        order: { blockNumber: 'DESC' },
      });

      if (!blockchainState) {
        this.logger.warn(
          `No blockchain state found for blockchain: ${blockchainId}`,
        );
        BlockchainsErrorHelpers.throwBlockchainStateNotFound(blockchainId);
      }

      const { queueSize, cacheSize } = blockchainState!; // Safe to use ! because we throw if null

      this.logger.debug(
        `Raw cache data for blockchain ${blockchainId} - Queue: ${queueSize} bytes, Cache: ${cacheSize} bytes`,
      );

      const cacheFilledPercentage =
        (Number(queueSize) / Number(cacheSize)) * 100;
      const queueSizeMB = Number(queueSize) / UNIT_CONVERSIONS.BYTES_TO_MB;
      const cacheSizeMB = Number(cacheSize) / UNIT_CONVERSIONS.BYTES_TO_MB;

      const result: CacheStatsResponse = {
        queueSize,
        cacheSize,
        queueSizeMB,
        cacheSizeMB,
        cacheFilledPercentage,
      };

      this.logger.log(
        `Cache stats calculated for blockchain ${blockchainId} - ${cacheFilledPercentage.toFixed(2)}% filled (${queueSizeMB.toFixed(2)}MB / ${cacheSizeMB.toFixed(2)}MB)`,
      );
      this.logger.debug(
        `Detailed cache stats for blockchain ${blockchainId}:`,
        result,
      );

      return result;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get cache stats for blockchain ${blockchainId}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Get total bytecodes count and difference from last month
   */
  async getTotalBytecodes(
    blockchainId: string,
  ): Promise<BytecodeStatsResponse> {
    try {
      this.logger.debug(
        `Getting total bytecodes count for blockchain: ${blockchainId}`,
      );

      // Validate blockchain exists
      await this.blockchainCrudService.validateBlockchainExists(blockchainId);

      this.logger.debug(
        `Querying cached bytecodes for blockchain: ${blockchainId}`,
      );
      const bytecodeCount = await this.bytecodeRepository.count({
        where: { blockchain: { id: blockchainId }, isCached: true },
      });

      const result: BytecodeStatsResponse = {
        bytecodeCount,
        bytecodeCountDiffWithLastMonth: 0, // Will be calculated by main service
      };

      this.logger.log(
        `Total bytecodes for blockchain ${blockchainId}: ${bytecodeCount} cached bytecodes`,
      );
      this.logger.debug(
        `Bytecode stats for blockchain ${blockchainId}:`,
        result,
      );

      return result;
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
   * Get total bytecodes with trends data (requires analytics service)
   */
  async getTotalBytecodesWithTrends(
    blockchainId: string,
    netBytecodesTrends: Array<{ currentTotal: number }>,
  ): Promise<BytecodeStatsWithTrendsResponse> {
    try {
      this.logger.debug(
        `Computing bytecodes with trends for blockchain: ${blockchainId}`,
      );
      this.logger.debug(
        `Net bytecodes trends data points: ${netBytecodesTrends.length}`,
      );

      const { bytecodeCount } = await this.getTotalBytecodes(blockchainId);

      let bytecodeCountDiffWithLastPeriod = 0;

      // Check if we have enough data to calculate the difference
      if (netBytecodesTrends && netBytecodesTrends.length >= 2) {
        const currentTotal =
          netBytecodesTrends[netBytecodesTrends.length - 1].currentTotal;
        const previousTotal =
          netBytecodesTrends[netBytecodesTrends.length - 2].currentTotal;
        bytecodeCountDiffWithLastPeriod = currentTotal - previousTotal;

        this.logger.debug(
          `Trend calculation for blockchain ${blockchainId} - Current: ${currentTotal}, Previous: ${previousTotal}, Diff: ${bytecodeCountDiffWithLastPeriod}`,
        );
      } else {
        this.logger.warn(
          `Insufficient trend data for blockchain ${blockchainId} - need at least 2 periods, got ${netBytecodesTrends.length}`,
        );
      }

      const result: BytecodeStatsWithTrendsResponse = {
        bytecodeCount,
        bytecodeCountDiffWithLastPeriod,
      };

      this.logger.log(
        `Bytecodes with trends for blockchain ${blockchainId}: ${bytecodeCount} total (${bytecodeCountDiffWithLastPeriod > 0 ? '+' : ''}${bytecodeCountDiffWithLastPeriod} vs last period)`,
      );

      return result;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get bytecodes with trends for blockchain ${blockchainId}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }
}
