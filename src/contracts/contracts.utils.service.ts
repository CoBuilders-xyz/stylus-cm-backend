import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { BlockchainState } from '../blockchains/entities/blockchain-state.entity';

/**
 * This service contains utility functions for processing contract data
 * and calculating derived values that need to be computed at request time.
 */
@Injectable()
export class ContractsUtilsService {
  private readonly logger = new Logger(ContractsUtilsService.name);

  constructor(
    @InjectRepository(BlockchainState)
    private readonly blockchainStateRepository: Repository<BlockchainState>,
  ) {}

  /**
   * Get the current decay rate from blockchain state for a specific blockchain
   * @param blockchainId The ID of the blockchain to get the decay rate for
   * @returns The current decay rate as a string
   */
  private async getDecayRate(blockchainId: string): Promise<string> {
    try {
      // Fetch the latest blockchain state to get the decay rate
      const latestState = await this.blockchainStateRepository.findOne({
        where: { blockchain: { id: blockchainId } },
        order: { blockNumber: 'DESC' },
      });

      if (!latestState) {
        this.logger.warn(
          `No blockchain state found for blockchain ${blockchainId}, using default decay rate of 0`,
        );
        return '0';
      }

      return latestState.decayRate;
    } catch (error) {
      this.logger.error(`Error fetching decay rate: ${error.message}`);
      // If there's an error, return 0 as a safe default
      return '0';
    }
  }

  /**
   * Calculate the effective bid for a contract
   * Formula: lastBid - (currentTimestamp - bidBlockTimestamp) * currentDecayRate
   * Minimum value is 0
   *
   * @param contract The contract to calculate the effective bid for
   * @param decayRate Optional decay rate to use (if already fetched)
   * @returns The calculated effective bid value
   */
  async calculateEffectiveBid(
    contract: Contract,
    decayRate?: string,
  ): Promise<string> {
    try {
      // If no decay rate is provided, fetch it
      const actualDecayRate =
        decayRate || (await this.getDecayRate(contract.blockchain.id));

      // Get the current timestamp in seconds
      const currentTimestamp = Math.floor(Date.now() / 1000);

      // Get the bid block timestamp in seconds
      const bidBlockTimestamp = Math.floor(
        contract.bidBlockTimestamp.getTime() / 1000,
      );

      // Calculate the time elapsed since the bid in seconds
      const timeElapsed = currentTimestamp - bidBlockTimestamp;

      // Parse the values to BigInt to avoid precision issues
      const lastBidBigInt = BigInt(contract.lastBid);
      const timeElapsedBigInt = BigInt(timeElapsed);
      const decayRateBigInt = BigInt(actualDecayRate);

      // Calculate the decay amount
      const decayAmount = timeElapsedBigInt * decayRateBigInt;

      // Calculate the effective bid
      let effectiveBid = lastBidBigInt;

      // Only subtract if decay amount is less than the last bid
      if (decayAmount < lastBidBigInt) {
        effectiveBid = lastBidBigInt - decayAmount;
      } else {
        // If the decay amount is greater than or equal to the last bid, set to 0
        effectiveBid = BigInt(0);
      }

      return effectiveBid.toString();
    } catch (error) {
      this.logger.error(`Error calculating effective bid: ${error.message}`);
      // In case of an error, return 0 as a safe default
      return '0';
    }
  }

  /**
   * Calculate the eviction risk for a contract
   * @param contract The contract to calculate the eviction risk for
   * @returns The calculated eviction risk value (could be a percentage or score)
   */
  calculateEvictionRisk(contract: Contract): number {
    // TODO: Implement the calculation logic
    // This will be implemented in future iterations
    return 0; // Default return value
  }

  /**
   * Process a contract to add calculated fields
   * @param contract The contract to process
   * @param decayRate Optional decay rate to use (if already fetched)
   * @returns The contract with additional calculated fields
   */
  async processContract(
    contract: Contract,
    decayRate?: string,
  ): Promise<Contract & { effectiveBid: string; evictionRisk: number }> {
    return {
      ...contract,
      effectiveBid: await this.calculateEffectiveBid(contract, decayRate),
      evictionRisk: this.calculateEvictionRisk(contract),
    };
  }

  /**
   * Process an array of contracts to add calculated fields to each one
   * @param contracts The array of contracts to process
   * @returns The processed contracts with additional calculated fields
   */
  async processContracts(
    contracts: Contract[],
  ): Promise<(Contract & { effectiveBid: string; evictionRisk: number })[]> {
    if (contracts.length === 0) {
      return [];
    }

    // Get blockchainId from the first contract
    // This assumes all contracts in the array are from the same blockchain
    const blockchainId = contracts[0].blockchain.id;

    // Get the decay rate once for all contracts to avoid multiple DB queries
    const decayRate = await this.getDecayRate(blockchainId);

    // Process all contracts in parallel using Promise.all with the same decay rate
    const processedContracts = await Promise.all(
      contracts.map((contract) => this.processContract(contract, decayRate)),
    );

    return processedContracts;
  }
}
