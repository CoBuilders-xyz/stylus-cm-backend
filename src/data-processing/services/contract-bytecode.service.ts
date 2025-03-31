import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Bytecode } from '../../contracts/entities/bytecode.entity';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { ContractBytecodeState } from '../interfaces/contract-bytecode-state.interface';
import { ethers } from 'ethers';
import { abi } from '../../constants/abis/arbWasmCache/arbWasmCache.json';

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
    // Process each contract bytecode state
    for (const [codeHash, state] of contractBytecodeStates.entries()) {
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
          // await this.createNewContractBytecode(blockchain, codeHash, state);
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Error updating/creating contract bytecode ${codeHash}: ${errorMessage}`,
        );
      }
    }

    this.logger.log(
      `Updated ${contractBytecodeStates.size} contract bytecodes for blockchain ${blockchain.name}`,
    );
  }

  /**
   * Update an existing contract in the database
   *
   * @param contract The contract entity to update
   * @param state The current state of the contract
   */
  private async updateExistingBytecode(
    bytecode: Bytecode,
    state: ContractBytecodeState,
  ): Promise<void> {
    // Check the lastEventName to determine how to update the contract
    if (state.lastEventName === 'DeleteBid') {
      // For DeleteBid events, only update isCached and lastEvictionBid
      // Preserve existing values for lastBid, bidPlusDecay, totalBidInvestment, and size
      bytecode.isCached = false; // Always set to false for DeleteBid
      if (state.lastEvictionBid !== undefined) {
        bytecode.lastEvictionBid = state.lastEvictionBid.toString();
      }
      // Do not update size, bid, bidPlusDecay, or totalBidInvestment fields

      this.logger.debug(
        `Updated contract bytecode ${bytecode.bytecodeHash} in the database for DeleteBid, cached status: false` +
          ` (last event at block ${state.lastEventBlock})` +
          `, lastEvictionBid: ${state.lastEvictionBid}` +
          `, preserving bid: ${bytecode.lastBid}, bidPlusDecay: ${bytecode.bidPlusDecay}, size: ${bytecode.size}, totalBidInvestment: ${bytecode.totalBidInvestment}`,
      );
    } else {
      // For other events (like InsertBid), update all fields
      bytecode.lastBid = state.bid.toString();
      bytecode.bidPlusDecay = state.bidPlusDecay.toString();
      bytecode.size = state.size; // Update size for InsertBid events
      // Set lastEvictionBid if available
      if (state.lastEvictionBid !== undefined) {
        bytecode.lastEvictionBid = state.lastEvictionBid.toString();
      }
      bytecode.isCached = state.isCached;
      bytecode.totalBidInvestment = state.totalBidInvestment.toString();

      this.logger.debug(
        `Updated contract bytecode ${bytecode.bytecodeHash} in the database, cached status: ${state.isCached}` +
          ` (last event at block ${state.lastEventBlock})` +
          `, bid: ${state.bid}, bidPlusDecay: ${state.bidPlusDecay}, size: ${state.size}` +
          (state.lastEvictionBid !== undefined
            ? `, lastEvictionBid: ${state.lastEvictionBid}`
            : '') +
          `, total investment: ${state.totalBidInvestment}`,
      );
    }

    await this.bytecodeRepository.save(bytecode);
  }

  // /**
  //  * Create a new contract in the database
  //  *
  //  * @param blockchain The blockchain the contract belongs to
  //  * @param codeHash The bytecode hash of the contract
  //  * @param state The current state of the contract
  //  */
  // private async createNewContractBytecode(
  //   blockchain: Blockchain,
  //   codeHash: string,
  //   state: ContractBytecodeState,
  // ): Promise<void> {
  //   // Can only create a new contract bytecode if we have an address
  //   if (!state.address) {
  //     this.logger.warn(
  //       `Cannot create new contract bytecode ${codeHash} without an address. This contract bytecode may have only had DeleteBid events.`,
  //     );
  //     return;
  //   }

  //   // Create new contract bytecode with appropriate values based on event type
  //   const newContractBytecode = this.contractBytecodeRepository.create({
  //     blockchain,
  //     bytecodeHash: codeHash,
  //     size: state.size,
  //     lastBid: state.bid,
  //     bidPlusDecay: state.bidPlusDecay,
  //     isCached: state.isCached, // Set the initial cached status
  //     totalBidInvestment: state.totalBidInvestment, // Set initial total bid investment
  //   });

  //   // Only set lastEvictionBid for DeleteBid events
  //   if (
  //     state.lastEventName === 'DeleteBid' &&
  //     state.lastEvictionBid !== undefined
  //   ) {
  //     newContractBytecode.lastEvictionBid = state.lastEvictionBid.toString();
  //     this.logger.debug(
  //       `Setting lastEvictionBid to ${state.lastEvictionBid} for new contract bytecode ${codeHash} created from DeleteBid event`,
  //     );
  //   }

  //   await this.contractBytecodeRepository.save(newContractBytecode);

  //   // Log creation details with appropriate message based on event type
  //   const logMessage =
  //     state.lastEventName === 'DeleteBid'
  //       ? `Created new contract bytecode ${codeHash} in the database from DeleteBid event, cached status: ${state.isCached}` +
  //         ` (last event at block ${state.lastEventBlock})` +
  //         `, lastEvictionBid: ${state.lastEvictionBid}` +
  //         `, bid: ${state.bid}, bidPlusDecay: ${state.bidPlusDecay}, total investment: ${state.totalBidInvestment}`
  //       : `Created new contract bytecode ${codeHash} in the database, cached status: ${state.isCached}` +
  //         ` (last event at block ${state.lastEventBlock})` +
  //         `, bid: ${state.bid}, bidPlusDecay: ${state.bidPlusDecay}` +
  //         (state.lastEvictionBid !== undefined
  //           ? `, lastEvictionBid: ${state.lastEvictionBid}`
  //           : '') +
  //         `, total investment: ${state.totalBidInvestment}`;

  //   this.logger.debug(logMessage);
  // }

  /**
   * Verifies the cache status of all contract bytecodes against the on-chain data
   * This is a safety net to ensure our database is accurate
   *
   * @param blockchain The blockchain to verify contract bytecodes for
   */
  async verifyContractBytecodeCacheStatus(
    blockchain: Blockchain,
  ): Promise<void> {
    try {
      this.logger.log(
        `Verifying contract bytecode cache status for blockchain ${blockchain.name} against on-chain data`,
      );

      // Connect to the blockchain
      const provider = new ethers.JsonRpcProvider(blockchain.rpcUrl);

      // Define interface for the ArbWasmCache contract methods we use
      interface ArbWasmCacheContract {
        codehashIsCached(codehash: string): Promise<boolean>;
      }

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

      // For each contract bytecode, check its cached status on-chain
      for (const bytecode of bytecodes) {
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
          }
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Error verifying contract bytecode ${bytecode.bytecodeHash}: ${errorMessage}`,
          );
        }
      }

      this.logger.log(
        `Verification complete. Problematic contract bytecodes: ${this.problematicContractBytecodes.size}`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error verifying contract bytecodes: ${errorMessage}`);
    }
  }
}
