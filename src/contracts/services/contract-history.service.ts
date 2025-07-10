import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { ContractBidCalculatorService } from './contract-bid-calculator.service';
import { BidHistoryItem } from '../interfaces/contract.interfaces';

/**
 * Service responsible for retrieving and processing contract bidding history.
 * This service handles complex blockchain event analysis to build comprehensive bid histories.
 */
@Injectable()
export class ContractHistoryService {
  private readonly logger = new Logger(ContractHistoryService.name);

  constructor(
    @InjectRepository(BlockchainEvent)
    private readonly blockchainEventRepository: Repository<BlockchainEvent>,
    private readonly bidCalculatorService: ContractBidCalculatorService,
  ) {}

  /**
   * Get the bidding history for a contract from blockchain events
   * @param contractAddress The address of the contract to get bidding history for
   * @returns An array of bid events with parsed data
   */
  async getBiddingHistory(contractAddress: string): Promise<BidHistoryItem[]> {
    try {
      const normalizedAddress = contractAddress.toLowerCase();

      // Try multiple query strategies to find the InsertBid events for this contract

      // First attempt: Using direct JSONB access with explicit type casting and LOWER
      const bidEvents = await this.blockchainEventRepository
        .createQueryBuilder('event')
        .leftJoinAndSelect('event.blockchain', 'blockchain')
        .select([
          'event.id',
          'event.eventName',
          'event.blockTimestamp',
          'event.blockNumber',
          'event.transactionHash',
          'event.logIndex',
          'event.eventData',
          'event.originAddress',
          'event.contractName',
          'blockchain.id',
        ])
        .where('event.eventName = :eventName', { eventName: 'InsertBid' })
        .andWhere(
          'LOWER(CAST(event."eventData"->>1 AS TEXT)) = :contractAddress',
          {
            contractAddress: normalizedAddress,
          },
        )
        .orderBy('event.blockTimestamp', 'DESC')
        .getMany();

      // Also fetch all BidPlaced events for this contract to match with InsertBid events
      const automationEvents = await this.blockchainEventRepository
        .createQueryBuilder('event')
        .select([
          'event.id',
          'event.eventName',
          'event.blockTimestamp',
          'event.blockNumber',
          'event.transactionHash',
          'event.logIndex',
          'event.eventData',
          'event.originAddress',
          'event.contractName',
        ])
        .where('event.eventName = :eventName', { eventName: 'BidPlaced' })
        .andWhere(
          'LOWER(CAST(event."eventData"->>1 AS TEXT)) = :contractAddress',
          {
            contractAddress: normalizedAddress,
          },
        )
        .orderBy('event.blockTimestamp', 'DESC')
        .getMany();

      // Create a map of transaction hashes to BidPlaced events for efficient lookup
      const automationMap = new Map(
        automationEvents.map((event) => [event.transactionHash, event]),
      );

      // Parse the event data from the primary query
      const processedItems: BidHistoryItem[] = [];

      for (const event of bidEvents) {
        try {
          // Extract data from the eventData array
          const eventData = event.eventData as unknown as string[];
          const [bytecodeHash, eventContractAddress, bid, size] = eventData;

          // Calculate actual bid using the bid calculator service
          const decayRate = await this.bidCalculatorService.getDecayRate(
            event.blockchain.id,
            event.blockTimestamp,
          );
          const originDate = new Date(0);
          const actualBid = this.bidCalculatorService.calculateEffectiveBid(
            originDate,
            event.blockTimestamp,
            bid,
            decayRate,
          );

          // Check if this InsertBid event has a corresponding BidPlaced event
          // They should have the same transaction hash
          const matchingAutomationEvent = automationMap.get(
            event.transactionHash,
          );
          const isAutomated = !!matchingAutomationEvent;

          // If there's a matching automation event, extract its details
          let automationDetails:
            | {
                user: string;
                minBid: string;
                maxBid: string;
                userBalance: string;
              }
            | undefined = undefined;

          if (isAutomated && matchingAutomationEvent) {
            const automationData =
              matchingAutomationEvent.eventData as unknown as string[];
            // BidPlaced event data format: [user, contractAddress, bidAmount, minBid, maxBid, userBalance]
            automationDetails = {
              user: automationData[0],
              minBid: automationData[3],
              maxBid: automationData[4],
              userBalance: automationData[5],
            };
          }

          processedItems.push({
            bytecodeHash,
            contractAddress: eventContractAddress,
            bid,
            actualBid,
            size,
            timestamp: event.blockTimestamp,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            originAddress: event.originAddress || '',
            isAutomated,
            automationDetails,
          });
        } catch (err) {
          const error = err as Error;
          this.logger.error(`Error parsing bid event data: ${error.message}`);
          // Skip this item if there's an error
        }
      }

      // Log origin address inclusion stats
      const withOrigin = processedItems.filter(
        (item) => item.originAddress,
      ).length;
      const automatedBids = processedItems.filter(
        (item) => item.isAutomated,
      ).length;
      const totalItems = processedItems.length;
      this.logger.debug(
        `Bidding history: ${withOrigin}/${totalItems} entries have origin addresses, ${automatedBids}/${totalItems} are automated`,
      );

      return processedItems;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error fetching bidding history: ${err.message}`);
      return [];
    }
  }
}
