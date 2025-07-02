import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockchainState } from '../entities/blockchain-state.entity';
import { Bytecode } from '../../contracts/entities/bytecode.entity';
import { BlockchainsErrorHelpers } from '../blockchains.errors';
import { BlockchainCrudService } from './blockchain-crud.service';
import { UNIT_CONVERSIONS } from '../constants';
import {
  CacheStatsResponse,
  BytecodeStatsResponse,
  BytecodeStatsWithTrendsResponse,
} from '../interfaces';

@Injectable()
export class BlockchainMetricsService {
  private readonly logger = new Logger(BlockchainMetricsService.name);

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
      this.logger.log(`Getting cache stats for blockchain: ${blockchainId}`);

      const blockchainState = await this.blockchainStateRepository.findOne({
        where: { blockchain: { id: blockchainId } },
        order: { blockNumber: 'DESC' },
      });

      if (!blockchainState) {
        BlockchainsErrorHelpers.throwBlockchainStateNotFound(blockchainId);
      }

      const { queueSize, cacheSize } = blockchainState!;

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

      this.logger.log(`Cache stats calculated for blockchain: ${blockchainId}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error getting cache stats for blockchain: ${blockchainId}`,
        error,
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
      this.logger.log(
        `Getting total bytecodes for blockchain: ${blockchainId}`,
      );

      // Validate blockchain exists
      await this.blockchainCrudService.validateBlockchainExists(blockchainId);

      const bytecodeCount = await this.bytecodeRepository.count({
        where: { blockchain: { id: blockchainId }, isCached: true },
      });

      const result: BytecodeStatsResponse = {
        bytecodeCount,
        bytecodeCountDiffWithLastMonth: 0, // Will be calculated by main service
      };

      this.logger.log(
        `Total bytecodes calculated for blockchain: ${blockchainId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error getting total bytecodes for blockchain: ${blockchainId}`,
        error,
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
      const { bytecodeCount } = await this.getTotalBytecodes(blockchainId);

      let bytecodeCountDiffWithLastPeriod = 0;

      // Check if we have enough data to calculate the difference
      if (netBytecodesTrends && netBytecodesTrends.length >= 2) {
        bytecodeCountDiffWithLastPeriod =
          netBytecodesTrends[netBytecodesTrends.length - 1].currentTotal -
          netBytecodesTrends[netBytecodesTrends.length - 2].currentTotal;
      }

      return {
        bytecodeCount,
        bytecodeCountDiffWithLastPeriod,
      };
    } catch (error) {
      this.logger.error(
        `Error getting total bytecodes with trends for blockchain: ${blockchainId}`,
        error,
      );
      throw error;
    }
  }
}
