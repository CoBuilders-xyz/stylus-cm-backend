import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { ContractBytecodeState } from '../interfaces/contract-bytecode-state.interface';
import { InsertBidService } from './insert-bid.service';
import { DeleteBidService } from './delete-bid.service';
import { DecayRateService } from './decay-rate.service';
import { ContractBytecodeService } from './contract-bytecode.service';
import { findApplicableDecayRate } from '../utils/event-utils';

@Injectable()
export class EventProcessorService {
  private readonly logger = new Logger(EventProcessorService.name);

  constructor(
    @InjectRepository(Blockchain)
    private readonly blockchainRepository: Repository<Blockchain>,
    @InjectRepository(BlockchainEvent)
    private readonly blockchainEventRepository: Repository<BlockchainEvent>,
    private readonly insertBidService: InsertBidService,
    private readonly deleteBidService: DeleteBidService,
    private readonly decayRateService: DecayRateService,
    private readonly contractBytecodeService: ContractBytecodeService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Process all events for all blockchains
   */
  async processAllEvents(): Promise<void> {
    this.logger.log('Starting full event processing...');

    try {
      // Get all blockchains
      const blockchains = await this.blockchainRepository.find();

      for (const blockchain of blockchains) {
        await this.processBlockchainAllEvents(blockchain);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in full event processing: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Process new events that have been created since the last processing
   */
  async processNewEvents(): Promise<void> {
    this.logger.log('Processing new events...');

    try {
      // Get all blockchains
      const blockchains = await this.blockchainRepository.find();

      for (const blockchain of blockchains) {
        await this.processBlockchainNewEvents(blockchain);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in new event processing: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Process all events for a specific blockchain
   *
   * @param blockchain The blockchain to process events for
   */
  private async processBlockchainAllEvents(
    blockchain: Blockchain,
  ): Promise<void> {
    this.logger.log(`Processing all events for blockchain: ${blockchain.name}`);

    let events: BlockchainEvent[] = [];

    // Check if we've processed events for this blockchain before
    if (blockchain.lastProcessedEventId) {
      this.logger.log(
        `Resuming processing from last processed event (Block: ${blockchain.lastProcessedBlockNumber}, LogIndex: ${blockchain.lastProcessedLogIndex})`,
      );

      // Use queryBuilder instead of raw query to ensure proper relation loading
      events = await this.blockchainEventRepository
        .createQueryBuilder('event')
        .leftJoinAndSelect('event.blockchain', 'blockchain')
        .where('blockchain.id = :blockchainId', { blockchainId: blockchain.id })
        .andWhere('event.eventName IN (:...eventNames)', {
          eventNames: ['InsertBid', 'DeleteBid'],
        })
        .andWhere(
          '(event.blockNumber > :blockNumber OR (event.blockNumber = :blockNumber AND event.logIndex > :logIndex))',
          {
            blockNumber: blockchain.lastProcessedBlockNumber,
            logIndex: blockchain.lastProcessedLogIndex,
          },
        )
        .orderBy('event.blockNumber', 'ASC')
        .addOrderBy('event.logIndex', 'ASC')
        .getMany();

      // Log what events were returned and count by type
      const eventsByType: Record<string, number> = {};
      events.forEach((e) => {
        eventsByType[e.eventName] = (eventsByType[e.eventName] || 0) + 1;
      });

      const eventTypeSummary = Object.entries(eventsByType)
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ');

      this.logger.debug(`Query returned events by type: ${eventTypeSummary}`);
    } else {
      // If no events have been processed, get all events
      events = await this.blockchainEventRepository
        .createQueryBuilder('event')
        .leftJoinAndSelect('event.blockchain', 'blockchain')
        .where('blockchain.id = :blockchainId', { blockchainId: blockchain.id })
        .andWhere('event.eventName IN (:...eventNames)', {
          eventNames: ['InsertBid', 'DeleteBid'],
        })
        .orderBy('event.blockNumber', 'ASC')
        .addOrderBy('event.logIndex', 'ASC')
        .getMany();

      // Log what events were found
      const eventsByType: Record<string, number> = {};
      events.forEach((e) => {
        eventsByType[e.eventName] = (eventsByType[e.eventName] || 0) + 1;
      });

      const eventTypeSummary = Object.entries(eventsByType)
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ');

      this.logger.debug(
        `Find query returned events by type: ${eventTypeSummary}`,
      );
    }

    this.logger.log(`Found ${events.length} events to process`);

    // Process the events
    if (events.length > 0) {
      await this.processBlockchainEvents(blockchain, events);

      // Update the last processed event in the blockchain record
      await this.updateLastProcessedEvent(
        blockchain,
        events[events.length - 1],
      );
    }

    // Verify contract bytecodes at the end of processing if needed
    await this.contractBytecodeService.verifyContractBytecodeCacheStatus(
      blockchain,
    );
  }

  /**
   * Process new events for a specific blockchain
   *
   * @param blockchain The blockchain to process events for
   */
  private async processBlockchainNewEvents(
    blockchain: Blockchain,
  ): Promise<void> {
    this.logger.log(`Processing new events for blockchain: ${blockchain.name}`);

    // We can only process new events if we have processed some events before
    if (!blockchain.lastProcessedEventId) {
      this.logger.log(
        `No events have been processed yet for blockchain ${blockchain.name}. Running full processing...`,
      );
      return this.processBlockchainAllEvents(blockchain);
    }

    // Query to find events that are newer than the last processed event
    // Using queryBuilder instead of raw query to ensure proper relation loading
    const events = await this.blockchainEventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.blockchain', 'blockchain')
      .where('blockchain.id = :blockchainId', { blockchainId: blockchain.id })
      .andWhere('event.eventName IN (:...eventNames)', {
        eventNames: ['InsertBid', 'DeleteBid'],
      })
      .andWhere(
        '(event.blockNumber > :blockNumber OR (event.blockNumber = :blockNumber AND event.logIndex > :logIndex))',
        {
          blockNumber: blockchain.lastProcessedBlockNumber,
          logIndex: blockchain.lastProcessedLogIndex,
        },
      )
      .orderBy('event.blockNumber', 'ASC')
      .addOrderBy('event.logIndex', 'ASC')
      .getMany();

    // Log what events were returned and count by type
    const eventsByType: Record<string, number> = {};
    events.forEach((e) => {
      eventsByType[e.eventName] = (eventsByType[e.eventName] || 0) + 1;
    });

    const eventTypeSummary = Object.entries(eventsByType)
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ');

    this.logger.debug(
      `New events query returned events by type: ${eventTypeSummary}`,
    );

    this.logger.log(`Found ${events.length} new events to process`);

    // Process the events
    if (events.length > 0) {
      await this.processBlockchainEvents(blockchain, events);

      // Update the last processed event in the blockchain record
      await this.updateLastProcessedEvent(
        blockchain,
        events[events.length - 1],
      );
    }
  }

  /**
   * Update the last processed event information in the blockchain record
   *
   * @param blockchain The blockchain to update
   * @param lastEvent The last event that was processed
   */
  private async updateLastProcessedEvent(
    blockchain: Blockchain,
    lastEvent: BlockchainEvent,
  ): Promise<void> {
    try {
      blockchain.lastProcessedEventId = lastEvent.id;
      blockchain.lastProcessedBlockNumber = lastEvent.blockNumber;
      blockchain.lastProcessedLogIndex = lastEvent.logIndex || 0;

      await this.blockchainRepository.save(blockchain);

      this.logger.log(
        `Updated last processed event for blockchain ${blockchain.name} to ` +
          `event ${lastEvent.id} (Block: ${lastEvent.blockNumber}, LogIndex: ${lastEvent.logIndex}, EventName: ${lastEvent.eventName})`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error updating last processed event: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Process events for a specific blockchain
   *
   * @param blockchain The blockchain to process events for
   * @param events The events to process
   */
  private async processBlockchainEvents(
    blockchain: Blockchain,
    events: BlockchainEvent[],
  ): Promise<void> {
    // Count events by type for reporting
    const eventTypeCount: Record<string, number> = {};
    events.forEach((e) => {
      eventTypeCount[e.eventName] = (eventTypeCount[e.eventName] || 0) + 1;
    });

    const eventTypeSummary = Object.entries(eventTypeCount)
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ');

    this.logger.log(`Processing events by type: ${eventTypeSummary}`);

    // Track contract bytecode states by codeHash
    const contractBytecodeStates = new Map<string, ContractBytecodeState>();

    // Extract and sort decay rate events
    const decayRateEvents =
      this.decayRateService.extractDecayRateEvents(events);

    // Get the current decay rate from blockchain state
    let currentDecayRate: string = '0';
    try {
      // Use proper QueryRunner from DataSource
      const queryRunner = this.dataSource.createQueryRunner();
      try {
        await queryRunner.connect();
        const latestBlockchainState =
          await this.decayRateService.getLatestBlockchainState(
            blockchain.id,
            queryRunner,
          );

        if (latestBlockchainState) {
          currentDecayRate = latestBlockchainState.decayRate;
          this.logger.debug(
            `Got current decay rate from blockchain state: ${currentDecayRate}`,
          );
        }
      } finally {
        // Always release the query runner
        await queryRunner.release();
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to get current decay rate from blockchain state: ${errorMessage}. Will attempt to find in events.`,
      );
    }

    // Process events in chronological order
    for (const event of events) {
      try {
        if (event.eventName === 'InsertBid') {
          // Log the InsertBid event that we're about to process
          this.logger.debug(
            `Processing InsertBid event from block ${event.blockNumber}, logIndex ${event.logIndex}, data: ${JSON.stringify(event.eventData)}`,
          );

          // Find the applicable decay rate for this event
          const applicableDecayRate = findApplicableDecayRate(
            event,
            decayRateEvents,
            currentDecayRate,
          );

          // Process InsertBid event with the applicable decay rate
          this.insertBidService.processInsertBidEvent(
            event,
            contractBytecodeStates,
            applicableDecayRate,
          );

          // Get the contract bytecode hash from the event data for logging
          const eventDataArray = event.eventData as unknown[];
          if (Array.isArray(eventDataArray) && eventDataArray.length > 0) {
            const codeHash = String(eventDataArray[0]);
            // Check if the contract bytecode state was updated successfully
            if (contractBytecodeStates.has(codeHash)) {
              this.logger.debug(
                `Successfully processed InsertBid for contract bytecode ${codeHash} at block ${event.blockNumber}`,
              );
            } else {
              this.logger.warn(
                `Failed to update contract bytecode state for InsertBid event for contract bytecode ${codeHash} at block ${event.blockNumber}`,
              );
            }
          }
        } else if (event.eventName === 'DeleteBid') {
          // Process DeleteBid event - now async
          await this.deleteBidService.processDeleteBidEvent(
            event,
            contractBytecodeStates,
          );
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Error processing event ${event.eventName}: ${errorMessage}`,
        );
        this.logger.error(`Event data: ${JSON.stringify(event.eventData)}`);
      }
    }

    // Update or create contracts in the database
    await this.contractBytecodeService.updateContractBytecodes(
      blockchain,
      contractBytecodeStates,
    );

    this.logger.log(
      `Processed ${events.length} events and updated ${contractBytecodeStates.size} contract bytecodes for blockchain ${blockchain.name}`,
    );
  }
}
