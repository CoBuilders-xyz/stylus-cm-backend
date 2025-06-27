import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Contract } from '../entities/contract.entity';
import { BlockchainState } from '../../blockchains/entities/blockchain-state.entity';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import {
  ProviderManager,
  ContractType,
} from '../../common/utils/provider.util';
import { CacheManagerContract } from '../interfaces/contract.interfaces';

/**
 * Service responsible for core bid calculations and decay rate operations.
 * This service handles the mathematical operations for effective bid calculations.
 */
@Injectable()
export class ContractBidCalculatorService {
  private readonly logger = new Logger(ContractBidCalculatorService.name);
  private readonly providerManager = new ProviderManager();

  constructor(
    @InjectRepository(BlockchainState)
    private readonly blockchainStateRepository: Repository<BlockchainState>,
    @InjectRepository(BlockchainEvent)
    private readonly blockchainEventRepository: Repository<BlockchainEvent>,
    @InjectRepository(Blockchain)
    private readonly blockchainRepository: Repository<Blockchain>,
  ) {}

  /**
   * Get a cache manager contract instance for a specific blockchain
   * @param blockchainId The ID of the blockchain to get the contract for
   * @returns The cache manager contract instance
   */
  async getCacheManagerContract(
    blockchainId: string,
  ): Promise<CacheManagerContract> {
    // Get the blockchain entity
    const blockchain = await this.blockchainRepository.findOne({
      where: { id: blockchainId },
    });

    if (!blockchain) {
      throw new Error(`Blockchain with ID ${blockchainId} not found`);
    }

    // Get the contract instance from the provider manager using the proper enum value
    const contract = this.providerManager.getContract(
      blockchain,
      ContractType.CACHE_MANAGER,
    );

    // Safe type assertion: we know this contract implements CacheManagerContract interface
    // because it's created with the CACHE_MANAGER type and the correct ABI
    return contract as unknown as CacheManagerContract;
  }

  /**
   * Get the decay rate from blockchain events for a specific blockchain at a specific timestamp
   * @param blockchainId The ID of the blockchain to get the decay rate for
   * @param timestamp Optional timestamp to get the decay rate at, defaults to current time
   * @returns The decay rate as a string
   */
  async getDecayRate(blockchainId: string, timestamp: Date): Promise<string> {
    try {
      // Try to find the most recent setDecayRate event before the target timestamp
      const decayRateEvent = await this.blockchainEventRepository.findOne({
        where: {
          blockchain: { id: blockchainId },
          eventName: 'SetDecayRate',
          blockTimestamp: LessThanOrEqual(timestamp),
        },
        order: { blockTimestamp: 'DESC' },
      });

      if (decayRateEvent) {
        // Parse the event data to get the decay rate
        const eventData = decayRateEvent.eventData as string[];
        // Assuming decay rate is the first parameter in the event data
        const decayRate = eventData[0];
        return decayRate;
      }

      // Fallback to checking the blockchain state if no event is found
      const latestState = await this.blockchainStateRepository.findOne({
        where: { blockchain: { id: blockchainId } },
        order: { blockNumber: 'DESC' },
      });

      if (latestState) {
        return latestState.decayRate;
      }

      this.logger.warn(
        `No decay rate information found for blockchain ${blockchainId}, using default decay rate of 0`,
      );
      return '0';
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error fetching decay rate: ${err.message}`);
      // If there's an error, return 0 as a safe default
      return '0';
    }
  }

  /**
   * Calculate the effective bid for a contract
   * Formula: lastBid - (currentTimestamp - bidBlockTimestamp) * currentDecayRate
   * Minimum value is 0
   *
   * @param startTimestamp The timestamp when the bid was placed
   * @param endTimestamp The current timestamp to calculate against
   * @param bidSize The original bid amount
   * @param decayRate The decay rate to apply
   * @returns The calculated effective bid value
   */
  calculateEffectiveBid(
    startTimestamp: Date,
    endTimestamp: Date,
    bidSize: string,
    decayRate: string,
  ): string {
    try {
      const timeElapsed = Math.floor(
        endTimestamp.getTime() / 1000 - startTimestamp.getTime() / 1000,
      );

      // Parse the values to BigInt to avoid precision issues
      const lastBidBigInt = BigInt(bidSize);
      const timeElapsedBigInt = BigInt(timeElapsed);
      const decayRateBigInt = BigInt(decayRate);

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
      const err = error as Error;
      this.logger.error(`Error calculating effective bid: ${err.message}`);
      // In case of an error, return 0 as a safe default
      return '0';
    }
  }

  /**
   * Calculate the effective bid for a contract using current timestamp
   * @param contract The contract to calculate the effective bid for
   * @returns The calculated effective bid value
   */
  async calculateCurrentContractEffectiveBid(
    contract: Contract,
  ): Promise<string> {
    const currentTimestamp = new Date();
    const decayRate = await this.getDecayRate(
      contract.blockchain.id,
      currentTimestamp,
    );
    const bidSize = contract.lastBid;
    const startTimestamp = contract.bidBlockTimestamp;
    const endTimestamp = new Date();
    return this.calculateEffectiveBid(
      startTimestamp,
      endTimestamp,
      bidSize,
      decayRate,
    );
  }
}
