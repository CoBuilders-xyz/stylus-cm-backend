import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { BlockchainState } from '../blockchains/entities/blockchain-state.entity';
import { BlockchainEvent } from '../blockchains/entities/blockchain-event.entity';

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
    @InjectRepository(BlockchainEvent)
    private readonly blockchainEventRepository: Repository<BlockchainEvent>,
  ) {}

  /**
   * Get the decay rate from blockchain events for a specific blockchain at a specific timestamp
   * @param blockchainId The ID of the blockchain to get the decay rate for
   * @param timestamp Optional timestamp to get the decay rate at, defaults to current time
   * @returns The decay rate as a string
   */
  private async getDecayRate(
    blockchainId: string,
    timestamp: Date,
  ): Promise<string> {
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
   * @param contract The contract to calculate the effective bid for
   * @param decayRate Optional decay rate to use (if already fetched)
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
   * Calculate the effective bid for a contract
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

  /**
   * Calculate the eviction risk for a contract
   * @param contract The contract to calculate the eviction risk for
   * @returns The calculated eviction risk value (could be a percentage or score)
   */
  calculateEvictionRisk(contract: Contract): number {
    // TODO: Implement the calculation logic based on contract parameters
    // For now, returning 0 as default value until implementation is complete
    // Use contract to avoid linter errors
    if (contract) {
      // Future implementation will use contract properties to calculate risk
    }
    return 0; // Default return value
  }

  /**
   * Get the bidding history for a contract from blockchain events
   * @param contractAddress The address of the contract to get bidding history for
   * @returns An array of bid events with parsed data
   */
  async getBiddingHistory(contractAddress: string): Promise<
    Array<{
      bytecodeHash: string;
      contractAddress: string;
      bid: string;
      actualBid: string;
      size: string;
      timestamp: Date;
      blockNumber: number;
      transactionHash: string;
      isAutomated: boolean;
      automationUser?: string;
    }>
  > {
    try {
      const normalizedAddress = contractAddress.toLowerCase();

      // Try multiple query strategies to find the InsertBid events for this contract

      // First attempt: Using direct JSONB access with explicit type casting and LOWER
      const bidEvents = await this.blockchainEventRepository
        .createQueryBuilder('event')
        .leftJoinAndSelect('event.blockchain', 'blockchain')
        .where('event.eventName = :eventName', { eventName: 'InsertBid' })
        .andWhere(
          'LOWER(CAST(event."eventData"->>1 AS TEXT)) = :contractAddress',
          {
            contractAddress: normalizedAddress,
          },
        )
        .orderBy('event.blockTimestamp', 'DESC')
        .getMany();

      // Get all transaction hashes to check for automated bids
      const transactionHashes = bidEvents.map((event) => event.transactionHash);

      // Fetch BidPlaced events from CacheManagerAutomation with matching transaction hashes
      const automatedBidEvents = await this.blockchainEventRepository
        .createQueryBuilder('event')
        .where('event.eventName = :eventName', { eventName: 'BidPlaced' })
        .andWhere('event.transactionHash IN (:...hashes)', {
          hashes: transactionHashes.length > 0 ? transactionHashes : [''],
        })
        .getMany();

      // Create a map of transaction hash to automation user for quick lookup
      const automationMap = new Map<string, string>();
      for (const event of automatedBidEvents) {
        try {
          const eventData = event.eventData as unknown as string[];
          // First parameter of BidPlaced event is the user address
          const userAddress = eventData[0];
          automationMap.set(event.transactionHash, userAddress);
        } catch (err) {
          this.logger.warn(`Error parsing BidPlaced event data: ${err}`);
        }
      }

      // Define the return type for typechecking
      type BidHistoryItem = {
        bytecodeHash: string;
        contractAddress: string;
        bid: string;
        actualBid: string;
        size: string;
        timestamp: Date;
        blockNumber: number;
        transactionHash: string;
        isAutomated: boolean;
        automationUser?: string;
      };

      // Parse the event data from the primary query
      const bidPromises = bidEvents.map(async (event) => {
        try {
          // Extract data from the eventData array
          const eventData = event.eventData as unknown as string[];
          const [bytecodeHash, eventContractAddress, bid, size] = eventData;

          // Calculate actual bid
          const decayRate = await this.getDecayRate(
            event.blockchain.id,
            event.blockTimestamp,
          );
          const originDate = new Date(0);
          const actualBid = this.calculateEffectiveBid(
            originDate,
            event.blockTimestamp,
            bid,
            decayRate,
          );

          // Check if this transaction was an automated bid
          const isAutomated = automationMap.has(event.transactionHash);
          const automationUser = isAutomated
            ? automationMap.get(event.transactionHash)
            : undefined;

          const result: BidHistoryItem = {
            bytecodeHash,
            contractAddress: eventContractAddress,
            bid,
            actualBid,
            size,
            timestamp: event.blockTimestamp,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            isAutomated,
            automationUser,
          };

          return result;
        } catch (err) {
          const error = err as Error;
          this.logger.error(`Error parsing bid event data: ${error.message}`);
          return null;
        }
      });

      // Resolve all promises and filter out any null values
      const results = await Promise.all(bidPromises);
      return results.filter((item): item is BidHistoryItem => item !== null);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error fetching bidding history: ${err.message}`);
      return [];
    }
  }

  /**
   * Process a contract to add calculated fields
   * @param contract The contract to process
   * @param decayRate Optional decay rate to use (if already fetched)
   * @param includeBiddingHistory Optional flag to include bidding history (default: false)
   * @returns The contract with additional calculated fields
   */
  async processContract(
    contract: Contract,
    includeBiddingHistory = false,
  ): Promise<
    Contract & {
      effectiveBid: string;
      evictionRisk: number;
      biddingHistory?: Array<{
        bytecodeHash: string;
        contractAddress: string;
        bid: string;
        actualBid: string;
        size: string;
        timestamp: Date;
        blockNumber: number;
        transactionHash: string;
        isAutomated: boolean;
        automationUser?: string;
      }>;
    }
  > {
    const processedContract = {
      ...contract,
      effectiveBid: await this.calculateCurrentContractEffectiveBid(contract),
      evictionRisk: this.calculateEvictionRisk(contract),
    };

    // Optionally include bidding history if requested
    if (includeBiddingHistory) {
      return {
        ...processedContract,
        biddingHistory: await this.getBiddingHistory(contract.address),
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
      effectiveBid: string;
      evictionRisk: number;
      biddingHistory?: Array<{
        bytecodeHash: string;
        contractAddress: string;
        bid: string;
        actualBid: string;
        size: string;
        timestamp: Date;
        blockNumber: number;
        transactionHash: string;
        isAutomated: boolean;
        automationUser?: string;
      }>;
    })[]
  > {
    if (contracts.length === 0) {
      return [];
    }

    // Process all contracts in parallel using Promise.all with the same decay rate
    const processedContracts = await Promise.all(
      contracts.map((contract) =>
        this.processContract(contract, includeBiddingHistory),
      ),
    );

    return processedContracts;
  }
}
