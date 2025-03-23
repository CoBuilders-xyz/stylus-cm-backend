import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Contract } from '../../contracts/entities/contract.entity';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { ContractState } from '../interfaces/contract-state.interface';
import { ethers } from 'ethers';
import { abi } from '../../constants/abis/arbWasmCache/arbWasmCache.json';

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  // Track problematic contracts for analysis
  private problematicContracts = new Set<string>();

  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
  ) {}

  /**
   * Update or create contracts in the database based on their current states
   *
   * @param blockchain The blockchain the contracts belong to
   * @param contractStates Map of contract states to persist
   */
  async updateContracts(
    blockchain: Blockchain,
    contractStates: Map<string, ContractState>,
  ): Promise<void> {
    // Process each contract state
    for (const [codeHash, state] of contractStates.entries()) {
      try {
        // Try to find existing contract
        const contract = await this.contractRepository.findOne({
          where: {
            blockchain: { id: blockchain.id },
            bytecodeHash: codeHash,
          } as FindOptionsWhere<Contract>,
        });

        if (contract) {
          await this.updateExistingContract(contract, state);
        } else {
          await this.createNewContract(blockchain, codeHash, state);
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Error updating/creating contract ${codeHash}: ${errorMessage}`,
        );
      }
    }

    this.logger.log(
      `Updated ${contractStates.size} contracts for blockchain ${blockchain.name}`,
    );
  }

  /**
   * Update an existing contract in the database
   *
   * @param contract The contract entity to update
   * @param state The current state of the contract
   */
  private async updateExistingContract(
    contract: Contract,
    state: ContractState,
  ): Promise<void> {
    // Update existing contract
    contract.lastBid = state.bid;
    contract.bidPlusDecay = state.bidPlusDecay;
    // Set lastEvictionBid if available
    if (state.lastEvictionBid !== undefined) {
      contract.lastEvictionBid = state.lastEvictionBid;
    }
    contract.size = state.size;
    // Set isCached based on the last event type for this contract
    contract.isCached = state.isCached;
    // Update total bid investment
    contract.totalBidInvestment = state.totalBidInvestment;
    await this.contractRepository.save(contract);

    this.logger.debug(
      `Updated contract ${contract.bytecodeHash} in the database, cached status: ${state.isCached}` +
        ` (last event at block ${state.lastEventBlock})` +
        `, bid: ${state.bid}, bidPlusDecay: ${state.bidPlusDecay}` +
        (state.lastEvictionBid !== undefined
          ? `, lastEvictionBid: ${state.lastEvictionBid}`
          : '') +
        `, total investment: ${state.totalBidInvestment}`,
    );
  }

  /**
   * Create a new contract in the database
   *
   * @param blockchain The blockchain the contract belongs to
   * @param codeHash The bytecode hash of the contract
   * @param state The current state of the contract
   */
  private async createNewContract(
    blockchain: Blockchain,
    codeHash: string,
    state: ContractState,
  ): Promise<void> {
    // Can only create a new contract if we have an address
    if (!state.address) {
      this.logger.warn(
        `Cannot create new contract ${codeHash} without an address. This contract may have only had DeleteBid events.`,
      );
      return;
    }

    // Create new contract
    const newContract = this.contractRepository.create({
      blockchain,
      address: state.address,
      bytecodeHash: codeHash,
      name: `Contract-${codeHash.substring(0, 8)}`,
      size: state.size,
      lastBid: state.bid,
      bidPlusDecay: state.bidPlusDecay,
      lastEvictionBid: state.lastEvictionBid,
      isCached: state.isCached, // Set the initial cached status
      totalBidInvestment: state.totalBidInvestment, // Set initial total bid investment
    });

    await this.contractRepository.save(newContract);

    this.logger.debug(
      `Created new contract ${codeHash} in the database, cached status: ${state.isCached}` +
        ` (last event at block ${state.lastEventBlock})` +
        `, bid: ${state.bid}, bidPlusDecay: ${state.bidPlusDecay}` +
        (state.lastEvictionBid !== undefined
          ? `, lastEvictionBid: ${state.lastEvictionBid}`
          : '') +
        `, total investment: ${state.totalBidInvestment}`,
    );
  }

  /**
   * Verifies the cache status of all contracts against the on-chain data
   * This is a safety net to ensure our database is accurate
   *
   * @param blockchain The blockchain to verify contracts for
   */
  async verifyContractCacheStatus(blockchain: Blockchain): Promise<void> {
    try {
      this.logger.log(
        `Verifying contract cache status for blockchain ${blockchain.name} against on-chain data`,
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
      const contracts = await this.contractRepository.find({
        where: {
          blockchain: { id: blockchain.id },
        } as FindOptionsWhere<Contract>,
      });

      this.logger.log(`Verifying ${contracts.length} contracts...`);

      // For each contract, check its cached status on-chain
      for (const contract of contracts) {
        try {
          // Call the ArbWasmCache contract to check if the contract is cached
          const isCachedOnChain: boolean = await arbWasmCache.codehashIsCached(
            contract.bytecodeHash,
          );

          // If the cached status is different from what we have in the database,
          // update the database
          if (contract.isCached !== isCachedOnChain) {
            this.logger.warn(
              `Contract ${contract.bytecodeHash} cache status mismatch: DB=${contract.isCached}, Chain=${isCachedOnChain}`,
            );

            // Add to problematic contracts for further analysis
            this.problematicContracts.add(contract.bytecodeHash);

            // Update the contract status in the database
            contract.isCached = isCachedOnChain;
            await this.contractRepository.save(contract);

            this.logger.log(
              `Updated contract ${contract.bytecodeHash} cached status to ${isCachedOnChain}`,
            );
          }
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Error verifying contract ${contract.bytecodeHash}: ${errorMessage}`,
          );
        }
      }

      this.logger.log(
        `Verification complete. Problematic contracts: ${this.problematicContracts.size}`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error verifying contracts: ${errorMessage}`);
    }
  }
}
