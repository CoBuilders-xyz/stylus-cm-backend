import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ethers } from 'ethers';
import { Contract } from '../entities/contract.entity';
import { ContractBidCalculatorService } from './contract-bid-calculator.service';
import { ContractBidAssessmentService } from './contract-bid-assessment.service';
import { ContractHistoryService } from './contract-history.service';
import {
  ContractResponse,
  ProgramTimeLeftReason,
} from '../interfaces/contract.interfaces';
import {
  ContractType,
  ProviderManager,
} from '../../common/utils/provider.util';

type ProgramTimeLeftResult = {
  seconds: string | null;
  reason: ProgramTimeLeftReason | null;
};

const PROGRAM_TIME_LEFT_CACHE_TTL_MS = 30_000;

const REVERT_REASON_BY_ERROR_NAME: Record<string, ProgramTimeLeftReason> = {
  ProgramNotActivated: 'never_activated',
  ProgramExpired: 'expired',
  ProgramNeedsUpgrade: 'needs_upgrade',
};

/**
 * Service responsible for enriching contracts with calculated fields and processing.
 * This service orchestrates calls to other specialized services to build complete contract data.
 */
@Injectable()
export class ContractEnrichmentService {
  private readonly logger = new Logger(ContractEnrichmentService.name);

  private revertSelectors: Record<ProgramTimeLeftReason, string> | null = null;

  constructor(
    private readonly bidCalculatorService: ContractBidCalculatorService,
    private readonly bidAssessmentService: ContractBidAssessmentService,
    private readonly historyService: ContractHistoryService,
    private readonly providerManager: ProviderManager,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
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
    const programTimeLeftPromise = this.readProgramTimeLeft(contract);

    let processedContract: ContractResponse = {
      ...contract,
      minBid: '0',
      programTimeLeft: null,
      programTimeLeftReason: null,
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

    const { seconds, reason } = await programTimeLeftPromise;
    processedContract = {
      ...processedContract,
      programTimeLeft: seconds,
      programTimeLeftReason: reason,
    };

    if (includeBiddingHistory) {
      const [biddingHistory, activationHistory] = await Promise.all([
        this.historyService.getBiddingHistory(contract.address),
        this.historyService.getActivationHistory(contract.address),
      ]);

      return {
        ...processedContract,
        biddingHistory,
        activationHistory,
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
   * Read programTimeLeft from the ArbWasm precompile.
   * Returns { seconds, reason }. When the precompile reverts with a known
   * typed error, seconds is null and reason encodes which state the program
   * is in ('never_activated' | 'expired' | 'needs_upgrade').
   */
  private async readProgramTimeLeft(
    contract: Contract,
  ): Promise<ProgramTimeLeftResult> {
    const cacheKey = `programTimeLeft:${contract.blockchain.id}:${contract.address.toLowerCase()}`;

    const cached = await this.cacheManager.get<ProgramTimeLeftResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const arbWasm = this.providerManager.getContract(
      contract.blockchain,
      ContractType.ARB_WASM,
    );

    let result: ProgramTimeLeftResult;
    try {
      const timeLeft = (await arbWasm.programTimeLeft(
        contract.address,
      )) as bigint;
      result = { seconds: timeLeft.toString(), reason: null };
    } catch (error) {
      result = this.decodeProgramTimeLeftRevert(arbWasm, error, contract);
    }

    await this.cacheManager.set(
      cacheKey,
      result,
      PROGRAM_TIME_LEFT_CACHE_TTL_MS,
    );
    return result;
  }

  /**
   * Map a revert from ArbWasm.programTimeLeft back to a typed reason. Tries
   * selector matching against a few candidate error-data locations first
   * (ethers v6 puts revert bytes in different places depending on the RPC
   * wrapping); falls back to matching the error name in the message.
   */
  private decodeProgramTimeLeftRevert(
    arbWasm: ethers.Contract,
    error: unknown,
    contract: Contract,
  ): ProgramTimeLeftResult {
    const selectors = this.getRevertSelectors(arbWasm);
    const errorData = extractRevertData(error);

    if (errorData) {
      for (const [name, selector] of Object.entries(selectors)) {
        if (errorData.toLowerCase().startsWith(selector.toLowerCase())) {
          return {
            seconds: null,
            reason: name as ProgramTimeLeftReason,
          };
        }
      }
    }

    const message = error instanceof Error ? error.message : String(error);
    for (const [errorName, reason] of Object.entries(
      REVERT_REASON_BY_ERROR_NAME,
    )) {
      if (message.includes(errorName)) {
        return { seconds: null, reason };
      }
    }

    this.logger.warn(
      `Failed to read programTimeLeft for ${contract.address}: ${message}`,
    );
    return { seconds: null, reason: null };
  }

  private getRevertSelectors(
    arbWasm: ethers.Contract,
  ): Record<ProgramTimeLeftReason, string> {
    if (this.revertSelectors) {
      return this.revertSelectors;
    }

    const selectors: Partial<Record<ProgramTimeLeftReason, string>> = {};
    for (const [errorName, reason] of Object.entries(
      REVERT_REASON_BY_ERROR_NAME,
    )) {
      const selector = arbWasm.interface.getError(errorName)?.selector;
      if (selector) {
        selectors[reason] = selector;
      }
    }

    this.revertSelectors = selectors as Record<ProgramTimeLeftReason, string>;
    return this.revertSelectors;
  }
}

/**
 * Extract the raw revert data (hex string starting with the 4-byte selector)
 * from an ethers/RPC error. The location varies between providers and wrappers.
 */
function extractRevertData(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const err = error as Record<string, unknown>;
  const candidates: unknown[] = [
    err.data,
    (err.revert as Record<string, unknown> | undefined)?.data,
    (
      (err.info as Record<string, unknown> | undefined)?.error as
        | Record<string, unknown>
        | undefined
    )?.data,
    (err.error as Record<string, unknown> | undefined)?.data,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.startsWith('0x')) {
      return candidate;
    }
  }

  return null;
}
