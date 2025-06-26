import { Injectable, Logger } from '@nestjs/common';
import { Contract } from '../entities/contract.entity';
import { ContractBidCalculatorService } from './contract-bid-calculator.service';
import { ContractBidAssessmentService } from './contract-bid-assessment.service';
import { ContractHistoryService } from './contract-history.service';
import {
  BidRiskLevels,
  RiskLevel,
  CacheStats,
  BidHistoryItem,
} from '../interfaces/contract.interfaces';

/**
 * Service responsible for enriching contracts with calculated fields and processing.
 * This service orchestrates calls to other specialized services to build complete contract data.
 */
@Injectable()
export class ContractEnrichmentService {
  private readonly logger = new Logger(ContractEnrichmentService.name);

  constructor(
    private readonly bidCalculatorService: ContractBidCalculatorService,
    private readonly bidAssessmentService: ContractBidAssessmentService,
    private readonly historyService: ContractHistoryService,
  ) {}

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
      biddingHistory?: BidHistoryItem[];
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
        await this.bidCalculatorService.calculateCurrentContractEffectiveBid(
          contract,
        );
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
        biddingHistory: await this.historyService.getBiddingHistory(
          contract.address,
        ),
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
      biddingHistory?: BidHistoryItem[];
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
}
