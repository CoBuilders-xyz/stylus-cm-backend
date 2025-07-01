import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Bytecode } from '../../contracts/entities/bytecode.entity';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { ContractBytecodeState } from '../interfaces/contract-bytecode-state.interface';
import { ethers } from 'ethers';
import { abi } from '../../common/abis/arbWasmCache/arbWasmCache.json';
import { DataProcessingErrorHelpers } from '../data-processing.errors';

// Define interface for the ArbWasmCache contract methods we use
interface ArbWasmCacheContract {
  codehashIsCached(codehash: string): Promise<boolean>;
}

@Injectable()
export class ContractBytecodeService {
  private readonly logger = new Logger(ContractBytecodeService.name);

  // Track problematic contracts bytecodes for analysis
  private problematicContractBytecodes = new Set<string>();

  constructor(
    @InjectRepository(Bytecode)
    private readonly bytecodeRepository: Repository<Bytecode>,
  ) {}

  /**
   * Update or create contract bytecodes in the database based on their current states
   *
   * @param blockchain The blockchain the contract bytecodes belong to
   * @param contractBytecodeStates Map of contract bytecode states to persist
   */
  async updateContractBytecodes(
    blockchain: Blockchain,
    contractBytecodeStates: Map<string, ContractBytecodeState>,
  ): Promise<void> {
    this.logger.debug(
      `Updating ${contractBytecodeStates.size} contract bytecodes for blockchain ${blockchain.name}`,
    );

    try {
      // Process each contract bytecode state
      for (const [codeHash, state] of contractBytecodeStates.entries()) {
        try {
          await this.processContractBytecode(blockchain, codeHash, state);
        } catch (error) {
          this.logger.error(
            `Error processing contract bytecode ${codeHash}: ${error}`,
            error instanceof Error ? error.stack : undefined,
          );
          // Continue processing other bytecodes even if one fails
        }
      }

      this.logger.log(
        `Successfully updated ${contractBytecodeStates.size} contract bytecodes for blockchain ${blockchain.name}`,
      );
    } catch (error) {
      this.logger.error(
        `Error updating contract bytecodes for blockchain ${blockchain.name}: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      DataProcessingErrorHelpers.throwDatabaseOperationFailed(
        'update contract bytecodes',
      );
    }
  }

  /**
   * Verifies the cache status of all contract bytecodes against the on-chain data
   * This is a safety net to ensure our database is accurate
   *
   * @param blockchain The blockchain to verify contract bytecodes for
   */
  async verifyContractBytecodeCacheStatus(
    blockchain: Blockchain,
  ): Promise<void> {
    this.logger.log(
      `Verifying contract bytecode cache status for blockchain ${blockchain.name} against on-chain data`,
    );

    try {
      // Connect to the blockchain
      const provider = new ethers.JsonRpcProvider(blockchain.rpcUrl);

      // Use the ArbWasmCache contract at the cacheManagerAddress
      const arbWasmCache = new ethers.Contract(
        blockchain.arbWasmCacheAddress,
        abi,
        provider,
      ) as unknown as ArbWasmCacheContract;

      // Get all contracts for this blockchain
      const bytecodes = await this.bytecodeRepository.find({
        where: {
          blockchain: { id: blockchain.id },
        } as FindOptionsWhere<Bytecode>,
      });

      this.logger.log(`Verifying ${bytecodes.length} contract bytecodes...`);

      let verificationCount = 0;
      let mismatchCount = 0;

      // For each contract bytecode, check its cached status on-chain
      for (const bytecode of bytecodes) {
        try {
          const hasMismatch = await this.verifySingleBytecode(
            arbWasmCache,
            bytecode,
          );
          verificationCount++;
          if (hasMismatch) {
            mismatchCount++;
          }
        } catch (error) {
          this.logger.error(
            `Error verifying contract bytecode ${bytecode.bytecodeHash}: ${error}`,
            error instanceof Error ? error.stack : undefined,
          );
          // Continue verifying other bytecodes even if one fails
        }
      }

      this.logger.log(
        `Verification complete. Verified: ${verificationCount}, Mismatches: ${mismatchCount}, Problematic: ${this.problematicContractBytecodes.size}`,
      );
    } catch (error) {
      this.logger.error(
        `Error verifying contract bytecodes: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      DataProcessingErrorHelpers.throwDatabaseOperationFailed(
        'verify contract bytecode cache status',
      );
    }
  }

  /**
   * Process a single contract bytecode
   */
  private async processContractBytecode(
    blockchain: Blockchain,
    codeHash: string,
    state: ContractBytecodeState,
  ): Promise<void> {
    try {
      // Try to find existing contract bytecode
      const bytecode = await this.bytecodeRepository.findOne({
        where: {
          blockchain: { id: blockchain.id },
          bytecodeHash: codeHash,
        } as FindOptionsWhere<Bytecode>,
      });

      if (bytecode) {
        await this.updateExistingBytecode(bytecode, state);
      } else {
        this.logger.debug(
          `No existing bytecode found for ${codeHash}, skipping creation`,
        );
        // Note: Creation logic was commented out in original code
        // await this.createNewContractBytecode(blockchain, codeHash, state);
      }
    } catch (error) {
      this.logger.error(
        `Error processing contract bytecode ${codeHash}: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      DataProcessingErrorHelpers.throwDatabaseOperationFailed(
        `process contract bytecode: ${codeHash}`,
      );
    }
  }

  /**
   * Verify a single bytecode against on-chain data
   */
  private async verifySingleBytecode(
    arbWasmCache: ArbWasmCacheContract,
    bytecode: Bytecode,
  ): Promise<boolean> {
    try {
      // Call the ArbWasmCache contract to check if the contract bytecode is cached
      const isCachedOnChain: boolean = await arbWasmCache.codehashIsCached(
        bytecode.bytecodeHash,
      );

      // If the cached status is different from what we have in the database,
      // update the database
      if (bytecode.isCached !== isCachedOnChain) {
        this.logger.warn(
          `Contract bytecode ${bytecode.bytecodeHash} cache status mismatch: DB=${bytecode.isCached}, Chain=${isCachedOnChain}`,
        );

        // Add to problematic contract bytecodes for further analysis
        this.problematicContractBytecodes.add(bytecode.bytecodeHash);

        // Update the contract bytecode status in the database
        bytecode.isCached = isCachedOnChain;
        await this.bytecodeRepository.save(bytecode);

        this.logger.log(
          `Updated contract bytecode ${bytecode.bytecodeHash} cached status to ${isCachedOnChain}`,
        );

        return true; // Indicate there was a mismatch
      }

      return false; // No mismatch
    } catch (error) {
      this.logger.error(
        `Error verifying single bytecode ${bytecode.bytecodeHash}: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      DataProcessingErrorHelpers.throwDatabaseOperationFailed(
        `verify single bytecode: ${bytecode.bytecodeHash}`,
      );
      // This line is unreachable but satisfies TypeScript
      return false;
    }
  }

  /**
   * Update an existing contract in the database
   *
   * @param bytecode The bytecode entity to update
   * @param state The current state of the contract
   */
  private async updateExistingBytecode(
    bytecode: Bytecode,
    state: ContractBytecodeState,
  ): Promise<void> {
    try {
      // Check the lastEventName to determine how to update the contract
      if (state.lastEventName === 'DeleteBid') {
        this.updateBytecodeForDeleteBid(bytecode, state);
      } else {
        this.updateBytecodeForOtherEvents(bytecode, state);
      }

      await this.bytecodeRepository.save(bytecode);
      this.logger.debug(
        `Successfully updated bytecode ${bytecode.bytecodeHash}`,
      );
    } catch (error) {
      this.logger.error(
        `Error updating existing bytecode ${bytecode.bytecodeHash}: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      DataProcessingErrorHelpers.throwDatabaseOperationFailed(
        `update existing bytecode: ${bytecode.bytecodeHash}`,
      );
    }
  }

  /**
   * Update bytecode for DeleteBid events
   */
  private updateBytecodeForDeleteBid(
    bytecode: Bytecode,
    state: ContractBytecodeState,
  ): void {
    // For DeleteBid events, only update isCached and lastEvictionBid
    // Preserve existing values for lastBid, bidPlusDecay, totalBidInvestment, and size
    bytecode.isCached = false; // Always set to false for DeleteBid
    if (state.lastEvictionBid !== undefined) {
      bytecode.lastEvictionBid = state.lastEvictionBid;
    }

    this.logger.debug(
      `Updated contract bytecode ${bytecode.bytecodeHash} for DeleteBid, cached status: false` +
        ` (last event at block ${state.lastEventBlock})` +
        `, lastEvictionBid: ${state.lastEvictionBid}` +
        `, preserving bid: ${bytecode.lastBid}, bidPlusDecay: ${bytecode.bidPlusDecay}, size: ${bytecode.size}, totalBidInvestment: ${bytecode.totalBidInvestment}`,
    );
  }

  /**
   * Update bytecode for other events (like InsertBid)
   */
  private updateBytecodeForOtherEvents(
    bytecode: Bytecode,
    state: ContractBytecodeState,
  ): void {
    // For other events (like InsertBid), update all fields
    bytecode.lastBid = state.bid;
    bytecode.bidPlusDecay = state.bidPlusDecay;
    bytecode.size = String(state.size); // Convert number to string
    bytecode.isCached = state.isCached;
    bytecode.totalBidInvestment = state.totalBidInvestment;

    // Set lastEvictionBid if available
    if (state.lastEvictionBid !== undefined) {
      bytecode.lastEvictionBid = state.lastEvictionBid;
    }

    this.logger.debug(
      `Updated contract bytecode ${bytecode.bytecodeHash} for other events, cached status: ${state.isCached}` +
        ` (last event at block ${state.lastEventBlock})` +
        `, bid: ${state.bid}, bidPlusDecay: ${state.bidPlusDecay}, size: ${state.size}` +
        (state.lastEvictionBid !== undefined
          ? `, lastEvictionBid: ${state.lastEvictionBid}`
          : '') +
        `, total investment: ${state.totalBidInvestment}`,
    );
  }
}
