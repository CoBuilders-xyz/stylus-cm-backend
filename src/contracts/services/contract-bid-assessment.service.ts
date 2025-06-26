import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from '../entities/contract.entity';
import { BlockchainState } from '../../blockchains/entities/blockchain-state.entity';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { ContractBidCalculatorService } from './contract-bid-calculator.service';
import { CacheStatisticsService } from './cache-statistics.service';
import {
  BidRiskLevels,
  RiskLevel,
  CacheStats,
} from '../interfaces/contract.interfaces';

/**
 * Service responsible for bid assessment, risk analysis, and bid recommendations.
 * This service handles all logic related to determining optimal bids and assessing risk levels.
 */
@Injectable()
export class ContractBidAssessmentService {
  private readonly logger = new Logger(ContractBidAssessmentService.name);

  constructor(
    @InjectRepository(BlockchainState)
    private readonly blockchainStateRepository: Repository<BlockchainState>,
    @InjectRepository(BlockchainEvent)
    private readonly blockchainEventRepository: Repository<BlockchainEvent>,
    @InjectRepository(Blockchain)
    private readonly blockchainRepository: Repository<Blockchain>,
    private readonly bidCalculatorService: ContractBidCalculatorService,
    private readonly cacheStatisticsService: CacheStatisticsService,
  ) {}

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
      const cacheManagerContract =
        await this.bidCalculatorService.getCacheManagerContract(
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
        vsHighRisk: this.cacheStatisticsService.calculatePercentage(
          effectiveBid,
          highRiskBid,
        ),
        vsMidRisk: this.cacheStatisticsService.calculatePercentage(
          effectiveBid,
          midRiskBid,
        ),
        vsLowRisk: this.cacheStatisticsService.calculatePercentage(
          effectiveBid,
          lowRiskBid,
        ),
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
      await this.bidCalculatorService.getCacheManagerContract(blockchainId);

    // Get minimum bid from contract
    const minBid = await cacheManagerContract['getMinBid(uint64)'](size);
    const minBidNum = Number(minBid);
    const minBidStr = minBid.toString();

    // Get cache statistics to adjust risk multipliers
    const cacheStats = await this.cacheStatisticsService.getCacheStatistics(
      blockchainId,
      minBidStr,
    );

    // Calculate dynamic risk multipliers based on cache statistics
    const riskMultipliers =
      this.cacheStatisticsService.calculateDynamicRiskMultipliers(cacheStats);

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
      await this.bidCalculatorService.getCacheManagerContract(blockchainId);

    // Get minimum bid from contract using the address variant
    const minBid = await cacheManagerContract['getMinBid(address)'](address);
    const minBidNum = Number(minBid);
    const minBidStr = minBid.toString();

    // Get cache statistics to adjust risk multipliers
    const cacheStats = await this.cacheStatisticsService.getCacheStatistics(
      blockchainId,
      minBidStr,
    );

    // Calculate dynamic risk multipliers based on cache statistics
    const riskMultipliers =
      this.cacheStatisticsService.calculateDynamicRiskMultipliers(cacheStats);

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
}
