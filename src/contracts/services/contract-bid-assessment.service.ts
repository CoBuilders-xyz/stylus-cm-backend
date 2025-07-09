import { Injectable, Logger } from '@nestjs/common';
import { Contract } from '../entities/contract.entity';
import { ContractBidCalculatorService } from './contract-bid-calculator.service';
import { CacheStatisticsService } from './cache-statistics.service';
import {
  RiskLevel,
  CacheStats,
  RiskMultipliers,
  EvictionRiskResult,
  SuggestedBidsResult,
} from '../interfaces/contract.interfaces';
import { RISK_MULTIPLIERS } from '../constants/risk-multipliers.constants';
import { ContractErrorHelpers } from '../contracts.errors';

/**
 * Service responsible for bid assessment, risk analysis, and bid recommendations.
 * This service handles all logic related to determining optimal bids and assessing risk levels.
 */
@Injectable()
export class ContractBidAssessmentService {
  private readonly logger = new Logger(ContractBidAssessmentService.name);

  constructor(
    private readonly bidCalculatorService: ContractBidCalculatorService,
    private readonly cacheStatisticsService: CacheStatisticsService,
  ) {}

  /**
   * Calculate the eviction risk for a contract
   * @param contract The contract to calculate the eviction risk for
   * @returns The calculated eviction risk value (could be a percentage or score)
   */
  async calculateEvictionRisk(contract: Contract): Promise<EvictionRiskResult> {
    try {
      this.logger.log(`Calculating eviction risk for contract ${contract.id}`);

      // Validate contract has required data
      if (!contract.bytecode) {
        this.logger.warn(
          `Contract ${contract.id} missing bytecode information`,
        );
        ContractErrorHelpers.throwRiskAssessmentFailed();
      }

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

      this.logger.log(
        `Successfully calculated eviction risk for contract ${contract.id}: ${riskLevel} risk, effective bid: ${effectiveBid.toString()}`,
      );

      return {
        riskLevel,
        remainingEffectiveBid: effectiveBid.toString(),
        suggestedBids,
        comparisonPercentages,
        cacheStats,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error calculating eviction risk for contract ${contract.id}: ${err.message}`,
        err.stack,
      );

      // Re-throw known contract errors
      if (
        err.name === 'BadRequestException' ||
        err.name === 'InternalServerErrorException' ||
        err.name === 'ServiceUnavailableException'
      ) {
        throw error;
      }

      // Return a default high-risk assessment in case of errors
      this.logger.warn(
        `Returning default high-risk assessment for contract ${contract.id} due to error`,
      );
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
  ): Promise<SuggestedBidsResult> {
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
  ): Promise<SuggestedBidsResult> {
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
  private calculateDynamicRiskMultipliers(stats: CacheStats): RiskMultipliers {
    // Base multipliers from constants
    const baseMultipliers = {
      highRisk: RISK_MULTIPLIERS.BASE_HIGH_RISK,
      midRisk: RISK_MULTIPLIERS.BASE_MID_RISK,
      lowRisk: RISK_MULTIPLIERS.BASE_LOW_RISK,
    };

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
      highRisk: baseMultipliers.highRisk,
      midRisk: baseMultipliers.midRisk * combinedAdjustment,
      lowRisk: baseMultipliers.lowRisk * combinedAdjustment,
    };
  }
}
