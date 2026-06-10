import { Injectable, Logger } from '@nestjs/common';
import { Contract } from '../entities/contract.entity';
import { ContractBidCalculatorService } from './contract-bid-calculator.service';
import { ContractBidAssessmentService } from './contract-bid-assessment.service';
import { ContractHistoryService } from './contract-history.service';
import { ContractResponse } from '../interfaces/contract.interfaces';
import { ContractType, ProviderManager } from '../../common/utils/provider.util';

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
    private readonly providerManager: ProviderManager,
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
  ): Promise<ContractResponse> {
    let processedContract: ContractResponse = {
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

    if (includeBiddingHistory) {
      const [biddingHistory, activationHistory, programTimeLeft] =
        await Promise.all([
          this.historyService.getBiddingHistory(contract.address),
          this.historyService.getActivationHistory(contract.address),
          this.readProgramTimeLeft(contract),
        ]);

      return {
        ...processedContract,
        biddingHistory,
        activationHistory,
        programTimeLeft,
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
  ): Promise<ContractResponse[]> {
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
   * Read programTimeLeft from ArbWasm precompile.
   * Returns seconds as string, "0" if expired, or null if not activated.
   */
  private async readProgramTimeLeft(
    contract: Contract,
  ): Promise<string | null> {
    try {
      const arbWasm = this.providerManager.getContract(
        contract.blockchain,
        ContractType.ARB_WASM,
      );
      const timeLeft: bigint = await arbWasm.programTimeLeft(contract.address);
      return timeLeft.toString();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('ProgramExpired') || msg.includes('0xc9b12e52')) {
        return '0';
      }
      if (msg.includes('ProgramNotActivated')) {
        return null;
      }
      this.logger.warn(
        `Failed to read programTimeLeft for ${contract.address}: ${msg}`,
      );
      return null;
    }
  }
}
